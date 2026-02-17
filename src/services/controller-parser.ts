import { Project, SourceFile, ClassDeclaration, MethodDeclaration, Decorator, Node } from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'
import { glob } from 'glob'
import { ParsedSwagger, ParsedEndpoint, Parameter, Response } from '../types/swagger.js'

const HTTP_STATUS_MAP: Record<string, string> = {
  OK: '200',
  CREATED: '201',
  ACCEPTED: '202',
  NO_CONTENT: '204',
  BAD_REQUEST: '400',
  UNAUTHORIZED: '401',
  FORBIDDEN: '403',
  NOT_FOUND: '404',
  CONFLICT: '409',
  UNPROCESSABLE_ENTITY: '422',
  TOO_MANY_REQUESTS: '429',
  INTERNAL_SERVER_ERROR: '500',
  SERVICE_UNAVAILABLE: '503',
}

export class ControllerParserService {
  private project: Project
  private apiErrors: Record<string, { code: number; message: string }> = {}
  private apiSuccessMessages: Record<string, string> = {}

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99, // Latest
        module: 99,
      },
    })
  }

  async parseFromFile(filePath: string, title?: string, version?: string): Promise<ParsedSwagger> {
    const absolutePath = path.resolve(filePath)
    const sourceFile = this.project.addSourceFileAtPath(absolutePath)

    this.tryLoadApiDefinitions(path.dirname(absolutePath))

    return this.parseSourceFile(sourceFile, title || path.basename(absolutePath), version || '1.0.0')
  }

  async parseFromDirectory(dirPath: string, title?: string, version?: string): Promise<ParsedSwagger> {
    const absolutePath = path.resolve(dirPath)
    const pattern = path.join(absolutePath, '**/*.controller.ts')
    const files = await glob(pattern)

    if (files.length === 0) {
      throw new Error(`No controller files found in ${dirPath}`)
    }

    let allEndpoints: ParsedEndpoint[] = []
    const allTags: Set<string> = new Set()

    for (const file of files) {
      const sourceFile = this.project.addSourceFileAtPath(file)
      const parsed = this.parseSourceFile(sourceFile, title || 'API', version || '1.0.0')
      allEndpoints = allEndpoints.concat(parsed.endpoints)
      parsed.tags.forEach((tag) => allTags.add(tag.name))
    }

    return {
      title: title || 'API',
      description: `Generated from ${files.length} controller file(s)`,
      version: version || '1.0.0',
      baseUrl: '',
      endpoints: allEndpoints,
      tags: Array.from(allTags).map((name) => ({ name })),
    }
  }

  private parseSourceFile(sourceFile: SourceFile, title: string, version: string): ParsedSwagger {
    const controllers = sourceFile.getClasses()
    const endpoints: ParsedEndpoint[] = []
    const tags: Set<string> = new Set()

    for (const controller of controllers) {
      const controllerDecorator = this.findDecorator(controller, 'Controller')
      if (!controllerDecorator) continue

      const basePath = this.extractDecoratorPath(controllerDecorator)
      const tag = this.extractControllerTag(controller, basePath)
      if (tag) tags.add(tag)

      const methods = controller.getMethods()
      for (const method of methods) {
        const endpoint = this.parseMethod(method, basePath, tag || 'default')
        if (endpoint) endpoints.push(endpoint)
      }
    }

    return {
      title,
      description: this.extractFileDescription(sourceFile),
      version,
      baseUrl: '',
      endpoints,
      tags: Array.from(tags).map((name) => ({ name })),
    }
  }

  private parseMethod(method: MethodDeclaration, basePath: string, tag: string): ParsedEndpoint | null {
    const httpMethodDecorator = this.findHttpMethodDecorator(method)
    if (!httpMethodDecorator) return null

    const { method: httpMethod, path: methodPath } = this.extractHttpMethod(httpMethodDecorator)
    const fullPath = this.joinPaths(basePath, methodPath)

    const parameters = this.extractParameters(method)
    const requestBody = this.extractRequestBody(method)
    const responses = this.extractResponses(method)

    return {
      path: fullPath,
      method: httpMethod,
      tags: [tag],
      summary: this.extractMethodSummary(method),
      description: this.extractMethodDescription(method),
      parameters,
      requestBody,
      responses,
      operationId: method.getName(),
    }
  }

  private findDecorator(classDecl: ClassDeclaration, name: string): Decorator | undefined {
    return classDecl.getDecorators().find((d) => {
      const callExpr = d.getCallExpression()
      if (!callExpr) return false
      const text = callExpr.getExpression().getText()
      return text === name
    })
  }

  private findHttpMethodDecorator(method: MethodDeclaration): Decorator | undefined {
    const httpMethods = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options']
    return method.getDecorators().find((d) => {
      const callExpr = d.getCallExpression()
      if (!callExpr) return false
      const text = callExpr.getExpression().getText()
      return httpMethods.includes(text)
    })
  }

  private extractDecoratorPath(decorator: Decorator): string {
    const callExpr = decorator.getCallExpression()
    if (!callExpr) return ''

    const args = callExpr.getArguments()
    if (args.length === 0) return ''

    const arg = args[0]
    const rawText = arg.getText().trim()

    // Handle array of paths: @Controller(['call-dnc', '/api/edge/call-dnc'])
    // Use the shortest path that doesn't contain '/api/edge/' prefix
    if (rawText.startsWith('[')) {
      const matches = rawText.matchAll(/['"]([^'"]+)['"]/g)
      let shortest: string | null = null
      for (const m of matches) {
        const p = m[1]
        if (shortest === null || p.length < shortest.length) {
          shortest = p
        }
      }
      if (shortest) {
        return shortest.startsWith('/') ? shortest : '/' + shortest
      }
      return ''
    }

    const text = rawText.replace(/['"]/g, '')
    return text.startsWith('/') ? text : '/' + text
  }

  private extractHttpMethod(decorator: Decorator): { method: string; path: string } {
    const callExpr = decorator.getCallExpression()
    if (!callExpr) return { method: 'GET', path: '' }

    const methodName = callExpr.getExpression().getText().toUpperCase()
    const args = callExpr.getArguments()
    const path = args.length > 0 ? args[0].getText().replace(/['"]/g, '') : ''

    return {
      method: methodName,
      path: path.startsWith('/') ? path : path ? '/' + path : '',
    }
  }

  private joinPaths(basePath: string, methodPath: string): string {
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const method = methodPath.startsWith('/') ? methodPath : '/' + methodPath
    return (base + method).replace(/\/+/g, '/')
  }

  private extractControllerTag(controller: ClassDeclaration, basePath: string): string | undefined {
    const name = controller.getName()
    if (!name) return undefined

    // Extract tag from class name (e.g., DialerController -> dialer)
    const match = name.match(/^(\w+?)Controller$/)
    if (match) {
      return match[1].toLowerCase()
    }

    // Use base path as fallback
    const pathTag = basePath.split('/').filter((p) => p)[0]
    return pathTag || undefined
  }

  private extractParameters(method: MethodDeclaration): Parameter[] {
    const parameters: Parameter[] = []
    const methodParams = method.getParameters()

    for (const param of methodParams) {
      const paramDecorators = param.getDecorators()
      for (const decorator of paramDecorators) {
        const callExpr = decorator.getCallExpression()
        if (!callExpr) continue

        const decoratorName = callExpr.getExpression().getText()
        const paramName = param.getName()

        if (decoratorName === 'Param' || decoratorName === 'Query' || decoratorName === 'Header') {
          const args = callExpr.getArguments()
          const decoratorPath = args.length > 0 ? args[0].getText().replace(/['"]/g, '') : paramName

          let paramIn = 'query'
          if (decoratorName === 'Param') paramIn = 'path'
          else if (decoratorName === 'Header') paramIn = 'header'

          parameters.push({
            name: decoratorPath,
            in: paramIn,
            description: this.extractParamDescription(param),
            required: !param.isOptional(),
            type: this.getTypeString(param),
          })
        }
      }
    }

    return parameters
  }

  private extractRequestBody(method: MethodDeclaration): any {
    const methodParams = method.getParameters()

    for (const param of methodParams) {
      const paramDecorators = param.getDecorators()
      const hasBodyDecorator = paramDecorators.some((d) => {
        const callExpr = d.getCallExpression()
        return callExpr?.getExpression().getText() === 'Body'
      })

      if (hasBodyDecorator) {
        const typeText = this.getTypeString(param)
        const properties = this.extractDTOProperties(param, typeText)

        return {
          description: this.extractParamDescription(param),
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties,
                required: this.getRequiredFields(param),
              },
            },
          },
          required: !param.isOptional(),
        }
      }
    }

    return undefined
  }

  private extractDTOProperties(_param: any, _typeText: string): Record<string, any> {
    const properties: Record<string, any> = {}

    try {
      const paramType = _param.getType()
      const typeProps = paramType.getProperties()

      for (const symbol of typeProps) {
        const name = symbol.getName()
        if (name.startsWith('__')) continue

        let propTypeStr = 'string'
        let description = ''
        let example: any = undefined

        for (const decl of symbol.getDeclarations()) {
          if (Node.isPropertyDeclaration(decl)) {
            // Class property — has decorators
            const typeNode = decl.getTypeNode()
            if (typeNode) {
              propTypeStr = this.simplifyType(typeNode.getText())
            } else {
              propTypeStr = this.simplifyType(decl.getType().getText())
            }

            for (const deco of decl.getDecorators()) {
              const callExpr = deco.getCallExpression()
              if (!callExpr) continue
              const decoName = callExpr.getExpression().getText()

              if (decoName === 'ApiProperty' || decoName === 'ApiPropertyOptional') {
                const args = callExpr.getArguments()
                if (args.length > 0) {
                  const argText = args[0].getText()
                  const descMatch = argText.match(/description:\s*['"`]([\s\S]*?)['"`]/)
                  if (descMatch) description = descMatch[1]
                  example = this.extractExampleFromArgText(argText)
                }
              }
            }
          } else if (Node.isPropertySignature(decl)) {
            // Interface / inline object type — no decorators
            const typeNode = decl.getTypeNode()
            if (typeNode) {
              propTypeStr = this.simplifyType(typeNode.getText())
            } else {
              propTypeStr = this.simplifyType(decl.getType().getText())
            }
          }
        }

        properties[name] = { type: propTypeStr, description, example }
      }
    } catch {
      // Fallback: empty (no placeholder)
    }

    return properties
  }

  private extractExampleFromArgText(argText: string): any {
    // String literal
    const strMatch = argText.match(/example:\s*(['"`])([^'"`]*)\1/)
    if (strMatch) return strMatch[2]

    // Boolean / null / number
    const primitiveMatch = argText.match(/example:\s*(true|false|null|-?\d+\.?\d*)/)
    if (primitiveMatch) {
      const val = primitiveMatch[1]
      if (val === 'true') return true
      if (val === 'false') return false
      if (val === 'null') return null
      return parseFloat(val)
    }

    return undefined
  }

  private simplifyType(typeText: string): string {
    return typeText
      .replace(/import\([^)]+\)\./g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private getRequiredFields(_param: any): string[] {
    try {
      const paramType = _param.getType()
      const typeProps = paramType.getProperties()
      const required: string[] = []

      for (const symbol of typeProps) {
        const name = symbol.getName()
        if (name.startsWith('__')) continue

        let isOptional = symbol.isOptional()

        for (const decl of symbol.getDeclarations()) {
          if (!Node.isPropertyDeclaration(decl) && !Node.isPropertySignature(decl)) continue

          if (decl.hasQuestionToken()) { isOptional = true; break }

          if (Node.isPropertyDeclaration(decl)) {
            for (const deco of decl.getDecorators()) {
              const callExpr = deco.getCallExpression()
              if (!callExpr) continue
              const decoName = callExpr.getExpression().getText()

              if (decoName === 'IsOptional' || decoName === 'ApiPropertyOptional') {
                isOptional = true; break
              }
              if (decoName === 'ApiProperty') {
                const args = callExpr.getArguments()
                if (args.length > 0 && /required:\s*false/.test(args[0].getText())) {
                  isOptional = true; break
                }
              }
            }
          }
          if (isOptional) break
        }

        if (!isOptional) required.push(name)
      }

      return required
    } catch {
      return []
    }
  }

  private extractResponses(method: MethodDeclaration): Record<string, Response> {
    const responses: Record<string, Response> = {}

    const decorators = method.getDecorators()
    for (const decorator of decorators) {
      const callExpr = decorator.getCallExpression()
      if (!callExpr) continue

      const decoratorName = callExpr.getExpression().getText()
      if (decoratorName !== 'ApiResponse') continue

      const args = callExpr.getArguments()
      if (args.length === 0) continue

      const argText = args[0].getText()
      const statusCode = this.resolveStatusCode(argText)
      const description = this.resolveDescription(argText)

      if (statusCode) {
        responses[statusCode] = { description }
      }
    }

    // Ensure standard responses are always present
    if (!responses['401']) responses['401'] = { description: 'Unauthorized' }
    if (!responses['500']) responses['500'] = { description: 'Internal Server Error' }

    return responses
  }

  private resolveStatusCode(argText: string): string | null {
    // Match HttpStatus.OK, HttpStatus.CREATED, etc.
    const httpStatusMatch = argText.match(/status:\s*HttpStatus\.(\w+)/)
    if (httpStatusMatch) {
      return HTTP_STATUS_MAP[httpStatusMatch[1]] || null
    }
    // Match numeric status
    const numericMatch = argText.match(/status:\s*(\d+)/)
    if (numericMatch) return numericMatch[1]
    return null
  }

  private resolveDescription(argText: string): string {
    // Find the description property value
    // Use indexOf to locate 'description:' then extract the rest
    const descIdx = argText.indexOf('description:')
    if (descIdx === -1) return 'Response'

    const afterDesc = argText.slice(descIdx + 'description:'.length).trim()

    // String literal
    const strMatch = afterDesc.match(/^['"`]([^'"`]*)['"`]/)
    if (strMatch) return strMatch[1]

    // generateApiErrorDescription([ApiErrors.X, ...])
    if (afterDesc.startsWith('generateApiErrorDescription')) {
      return this.resolveGenerateApiErrorDescription(afterDesc)
    }

    // generateDescription([ApiSuccessMessages.X, ...])
    if (afterDesc.startsWith('generateDescription')) {
      return this.resolveGenerateDescription(afterDesc)
    }

    // Property access: ApiSuccessMessages.X or ApiErrors.X
    const propMatch = afterDesc.match(/^(\w+)\.(\w+)/)
    if (propMatch) {
      const [, obj, key] = propMatch
      if (obj === 'ApiSuccessMessages' && this.apiSuccessMessages[key]) {
        return this.apiSuccessMessages[key]
      }
      if (obj === 'ApiErrors' && this.apiErrors[key]) {
        const e = this.apiErrors[key]
        return `${e.code}: ${e.message}`
      }
    }

    return 'Response'
  }

  private resolveGenerateApiErrorDescription(text: string): string {
    // Extract all ApiErrors.X references from the function call
    const matches = text.matchAll(/ApiErrors\.(\w+)/g)
    const parts: string[] = []
    for (const m of matches) {
      const key = m[1]
      const err = this.apiErrors[key]
      if (err) {
        parts.push(`${err.code}: ${err.message}<br><br>`)
      } else {
        parts.push(`${key}<br><br>`)
      }
    }
    return parts.join('') || 'Bad Request'
  }

  private resolveGenerateDescription(text: string): string {
    // Extract all ApiSuccessMessages.X references from the function call
    const matches = text.matchAll(/ApiSuccessMessages\.(\w+)/g)
    const parts: string[] = []
    for (const m of matches) {
      const key = m[1]
      const msg = this.apiSuccessMessages[key]
      if (msg) {
        parts.push(`${msg}<br><br>`)
      } else {
        parts.push(`${key}<br><br>`)
      }
    }
    return parts.join('') || 'Success'
  }

  private tryLoadApiDefinitions(controllerDir: string): void {
    // Walk up directory tree to find the 'common/response/messages' folder
    const candidates = [
      path.resolve(controllerDir, '../../common/response/messages'),
      path.resolve(controllerDir, '../../../common/response/messages'),
      path.resolve(controllerDir, '../../../../common/response/messages'),
      path.resolve(controllerDir, '../../../../../common/response/messages'),
    ]

    for (const dir of candidates) {
      const errorsFile = path.join(dir, 'api-errors.ts')
      const successFile = path.join(dir, 'api-success.messages.ts')

      if (fs.existsSync(errorsFile)) {
        this.loadApiErrors(errorsFile)
      }
      if (fs.existsSync(successFile)) {
        this.loadApiSuccessMessages(successFile)
      }
      if (Object.keys(this.apiErrors).length > 0 || Object.keys(this.apiSuccessMessages).length > 0) {
        break
      }
    }
  }

  private loadApiErrors(filePath: string): void {
    try {
      const text = fs.readFileSync(filePath, 'utf-8')
      // Match: PropertyName: errorCreator('message', code, ...)
      // Supports both single-line and multi-line errorCreator calls
      const matches = text.matchAll(/(\w+):\s*errorCreator\(\s*['"`]([\s\S]*?)['"`]\s*,\s*(\d+)/g)
      for (const m of matches) {
        this.apiErrors[m[1]] = { message: m[2].trim(), code: parseInt(m[3]) }
      }
    } catch {
      // Ignore load errors
    }
  }

  private loadApiSuccessMessages(filePath: string): void {
    try {
      const text = fs.readFileSync(filePath, 'utf-8')
      // Match: PropertyName: 'message string',
      const matches = text.matchAll(/(\w+):\s*['"`]([^'"`\n]+)['"`]/g)
      for (const m of matches) {
        this.apiSuccessMessages[m[1]] = m[2].trim()
      }
    } catch {
      // Ignore load errors
    }
  }

  private extractMethodSummary(method: MethodDeclaration): string {
    const decorators = method.getDecorators()
    for (const decorator of decorators) {
      const callExpr = decorator.getCallExpression()
      if (!callExpr) continue

      const decoratorName = callExpr.getExpression().getText()
      if (decoratorName === 'ApiOperation' || decoratorName === 'ApiSummary') {
        const args = callExpr.getArguments()
        if (args.length > 0) {
          const argText = args[0].getText()
          // Extract summary property from object: { summary: 'text', ... }
          const summaryMatch = argText.match(/summary:\s*['"`]([^'"`]+)['"`]/)
          if (summaryMatch) return summaryMatch[1]
          // Fallback: strip object braces and quotes for simple string args
          return argText.replace(/[{}'"`]/g, '').replace(/^\s*summary:\s*/, '').trim()
        }
      }
    }

    return ''
  }

  private extractMethodDescription(method: MethodDeclaration): string {
    const jsDocs = method.getJsDocs()
    if (jsDocs.length > 0) {
      const text = jsDocs[0].getFullText()
      return text.replace(/\/\*\*|\*\/|\*/g, '').trim()
    }

    return ''
  }

  private extractParamDescription(_param: any): string {
    // Note: Parameter JSDoc extraction is not fully supported by ts-morph
    // A full implementation would inspect JSDoc comments above the parameter
    return ''
  }

  private extractFileDescription(sourceFile: SourceFile): string {
    const statements = sourceFile.getStatements()
    if (statements.length > 0) {
      const firstStatement = statements[0]
      const jsDocs = (firstStatement as any).getJsDocs?.()
      if (jsDocs && jsDocs.length > 0) {
        return jsDocs[0].getText()
      }
    }

    return ''
  }

  private getTypeString(param: any): string {
    const typeNode = param.getTypeNode()
    if (!typeNode) return 'any'

    const text = typeNode.getText()
    // Simplify complex types
    if (text.includes('|')) return 'string'
    if (text === 'any') return 'any'

    return text.replace(/^(import\(.*\)\.)?/, '')
  }
}
