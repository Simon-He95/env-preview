export interface MaskKeyOptions {
  maskSecrets: boolean
  maskKeyPattern?: string
  unmaskKeyPattern?: string
}

function toRegExp(pattern?: string) {
  if (!pattern)
    return
  const p = pattern.trim()
  if (!p)
    return
  try {
    return new RegExp(p)
  }
  catch {

  }
}

export function shouldMaskKey(key: string, options: MaskKeyOptions): boolean {
  if (options.maskSecrets)
    return true

  const maskRe = toRegExp(options.maskKeyPattern)
  if (!maskRe)
    return false

  const unmaskRe = toRegExp(options.unmaskKeyPattern)
  if (unmaskRe && unmaskRe.test(key))
    return false

  return maskRe.test(key)
}
