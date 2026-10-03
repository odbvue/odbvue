import fs from 'fs'
import yaml from 'js-yaml'

export class YamlFile<T> {
  constructor(private path: string) {}

  private readFile = (): T => {
    if (!fs.existsSync(this.path)) return {} as T
    const content = fs.readFileSync(this.path, 'utf-8')
    if (!content.trim()) return {} as T
    return yaml.load(content) as T
  }

  private writeFile = (data: T) => {
    const content = yaml.dump(data, { indent: 2 })
    fs.writeFileSync(this.path, content)
  }

  get = (): T => this.readFile()

  set = (data: T) => this.writeFile(data)
}
