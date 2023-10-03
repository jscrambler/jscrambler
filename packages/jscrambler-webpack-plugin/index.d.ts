export = JscramblerPlugin;

type ObfuscationHook = 'emit' | 'processAssets';
type ObfuscationLevel = 'bundle' | 'module';
type statusActive = 1;
type statusInactive = 0;

interface JscramblerTransformation {
  name: string,
  options?: unknown
  status?: statusActive | statusInactive
}

interface JscramblerWebpackPluginOpts {
  enable?: boolean
  chunks?: string[]
  obfuscationHook?: ObfuscationHook
  obfuscationLevel?: ObfuscationLevel
  instrument?: false
  excludeList?: string[]
  ignoreFile?: string
  params?: JscramblerTransformation[]
  [key: string]: unknown
}

declare class JscramblerPlugin {
  constructor(_options?: JscramblerWebpackPluginOpts);

  apply(compiler: unknown): void;
}

