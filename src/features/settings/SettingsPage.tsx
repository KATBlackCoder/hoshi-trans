import { useAppStore } from '@/stores/appStore'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SettingsPage() {
  const { settings, updateSettings, availableModels } = useAppStore()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Ollama Model */}
      <div className="flex flex-col gap-2">
        <Label>Ollama model</Label>
        <Select
          value={settings.ollamaModel}
          onValueChange={(v) => updateSettings({ ollamaModel: v ?? '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model…" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target Language */}
      <div className="flex flex-col gap-2">
        <Label>Target language</Label>
        <Select
          value={settings.targetLang}
          onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">French</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* System Prompt */}
      <div className="flex flex-col gap-2">
        <Label>System prompt</Label>
        <Textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          rows={5}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded">{'{lang}'}</code> as placeholder for the target language name.
        </p>
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-2">
        <Label>Temperature: {settings.temperature.toFixed(1)}</Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Lower = more consistent, higher = more creative. Recommended: 0.3
        </p>
      </div>
    </div>
  )
}
