import { Project, SourceFile, ClassDeclaration, MethodDeclaration, Decorator } from 'ts-morph'
import * as path from 'path'
import { glob } from 'glob'
import { ParsedSwagger, ParsedEndpoint, Parameter, Response } from '../types/swagger.js'

export class ControllerParserService {
  private project: Project

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
    const text = arg.getText().replace(/['"]/g, '')
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

  private extractDTOProperties(param: any, typeText: string): Record<string, any> {
    const properties: Record<string, any> = {}

    // For now, create placeholder properties based on type
    // A full implementation would parse the DTO class definition
    if (typeText && typeText !== 'any') {
      properties['field'] = {
        type: 'string',
        description: 'DTO field',
      }
    }

    return properties
  }

  private getRequiredFields(param: any): string[] {
    // Simplified implementation
    // A full implementation would inspect the DTO class
    return !param.isOptional() ? ['field'] : []
  }

  private extractResponses(method: MethodDeclaration): Record<string, Response> {
    const responses: Record<string, Response> = {
      '200': {
        description: 'Success',
      },
      '400': {
        description: 'Bad Request',
      },
      '401': {
        description: 'Unauthorized',
      },
      '500': {
        description: 'Internal Server Error',
      },
    }

    // Check for explicit response type decorators
    const decorators = method.getDecorators()
    for (const decorator of decorators) {
      const callExpr = decorator.getCallExpression()
      if (!callExpr) continue

      const decoratorName = callExpr.getExpression().getText()
      if (decoratorName === 'ApiResponse' || decoratorName === 'HttpCode') {
        const args = callExpr.getArguments()
        if (args.length > 0) {
          const statusCode = args[0].getText()
          responses[statusCode] = {
            description: args.length > 1 ? args[1].getText().replace(/['"]/g, '') : 'Response',
          }
        }
      }
    }

    return responses
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
          return args[0].getText().replace(/['"]/g, '')
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
