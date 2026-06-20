import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '0.0.0.0'

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])

function resolveAssetPath(url) {
  const pathname = new URL(url, 'http://localhost').pathname
  const cleanPath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const candidate = resolve(join(root, cleanPath))

  if (!candidate.startsWith(root)) {
    return join(root, 'index.html')
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate
  }

  return join(root, 'index.html')
}

const server = createServer((request, response) => {
  const filePath = resolveAssetPath(request.url ?? '/')
  const extension = extname(filePath)

  response.setHeader('Content-Type', contentTypes.get(extension) ?? 'application/octet-stream')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')

  createReadStream(filePath)
    .on('error', () => {
      response.writeHead(500)
      response.end('Server error')
    })
    .pipe(response)
})

server.listen(port, host, () => {
  console.log(`Atlas Vivo listening on http://${host}:${port}`)
})
