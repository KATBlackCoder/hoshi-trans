## RunPod Cloud Setup

RunPod provides cloud GPU instances that can run Ollama models. This is ideal if you don't have a powerful local GPU or want to scale your translation workload.

### Prerequisites

- A RunPod account ([sign up here](https://www.runpod.io/))
- Sufficient credits for GPU instances

### Step 1: Create a RunPod Instance

Choose a GPU instance with sufficient VRAM and storage:

**Recommended configurations:**

- **RTX 4090 (24GB VRAM)** - Required for 30B+ models
  - Storage: 60GB+ (recommended)
  - Cost: ~$0.79/hour
  - Best for: Adult RPG translation, high-quality reasoning

- **RTX 3080/4080 (12GB VRAM)** - For 14B models only
  - Storage: 40GB+ (single model) or 60GB+ (both models)
  - Cost: ~$0.34/hour

**Storage Requirements:**
- Minimum 40GB storage for single model (~20GB + system overhead)
- 40GB storage for single model (~20GB + system overhead)

### Step 2: Container Start Command

Use one of these commands to automatically install and configure Ollama:

#### Option A: Both Models (60GB storage)

```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull qwen3:30b &&
ollama pull deepseek-r1:32b &&
sleep infinity
"
```

#### Option B: Qwen3:30b Only (40GB storage)

```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull qwen3:30b &&
sleep infinity
"
```

#### Option C: DeepSeek-R1:32b Only (40GB storage)

```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull deepseek-r1:32b &&
sleep infinity
"
```

#### Option D: Custom LudoLingo Models (from GitHub)

**⚠️ Important:** Ensure the modelfile files are committed and pushed to the GitHub repository before using these commands. The files must be available at the specified URLs.

**LudoLingo 7B (Qwen2.5-abliterate:7b):**
```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen2.5-abliterate:7b &&
curl -f -L -o /tmp/ludolingo.modelfile https://raw.githubusercontent.com/KATBlackCoder/LudoLingo/main/ludolingo.modelfile || exit 1 &&
ollama create ludolingo -f /tmp/ludolingo.modelfile || exit 1 &&
echo 'Model ludolingo created successfully' &&
sleep infinity
"
```

**LudoLingo 14B Qwen (Qwen2.5-1m-abliterated:14b):**
```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen2.5-1m-abliterated:14b &&
curl -f -L -o /tmp/ludolingo-qwen14b.modelfile https://raw.githubusercontent.com/KATBlackCoder/LudoLingo/main/ludolingo-qwen14b.modelfile || exit 1 &&
ollama create ludolingo-qwen14b -f /tmp/ludolingo-qwen14b.modelfile || exit 1 &&
echo 'Model ludolingo-qwen14b created successfully' &&
sleep infinity
"
```

**LudoLingo DeepSeek-R1 14B (deepseek-r1:14b):**
```bash
bash -c "
apt update && apt install -y curl lshw &&
curl -fsSL https://ollama.com/install.sh | sh &&
nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull deepseek-r1:14b &&
curl -f -L -o /tmp/ludolingo-deepseek-r1-14b.modelfile https://raw.githubusercontent.com/KATBlackCoder/LudoLingo/main/ludolingo-deepseek-r1-14b.modelfile || exit 1 &&
ollama create ludolingo-deepseek-r1-14b -f /tmp/ludolingo-deepseek-r1-14b.modelfile || exit 1 &&
echo 'Model ludolingo-deepseek-r1-14b created successfully' &&
sleep infinity
"
```


**Note:** If the modelfile files are not yet available on GitHub, you can create them directly in the container using a heredoc. See the [RunPod documentation](https://docs.runpod.io/pods/overview) for alternative setup methods.

### Step 3: Get Your Pod ID

1. After your pod starts, find your pod ID in the RunPod dashboard
2. It looks like: `abc123def456` (usually 12+ characters)
3. Copy just the pod ID (not the full URL)

### Step 4: Configure in LudoLingo

In LudoLingo Settings:

1. **Provider:** Select "RunPod"
2. **Pod ID:** Enter your pod ID (e.g., `abc123def456`)
3. **Model:** Select from available models:
   - `qwen3:30b` (if using Option A or B)
   - `deepseek-r1:32b` (if using Option A or C)
   - `ludolingo` (if using Option D - 7B)
   - `ludolingo-qwen14b` (if using Option D - 14B Qwen)
   - `ludolingo-deepseek-r1-14b` (if using Option D - 14B DeepSeek-R1)

**Note:** LudoLingo automatically converts your pod ID to the full RunPod URL: `https://abc123def456-11434.proxy.runpod.net`