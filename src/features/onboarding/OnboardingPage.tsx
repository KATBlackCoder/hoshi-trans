export function OnboardingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <h1 className="text-2xl font-bold">Ollama not detected</h1>
      <p className="text-muted-foreground text-center max-w-md">
        hoshi-trans requires Ollama running locally on{' '}
        <code className="font-mono bg-muted px-1 rounded">localhost:11434</code>.
      </p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          Install Ollama from{' '}
          <span className="font-mono text-primary">ollama.com</span>
        </li>
        <li>
          Run a model:{' '}
          <code className="font-mono bg-muted px-1 rounded">
            ollama pull qwen2.5:7b
          </code>
        </li>
        <li>Keep Ollama running in the background</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        This screen will disappear automatically once Ollama is detected.
      </p>
    </div>
  )
}
