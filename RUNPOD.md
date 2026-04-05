# RunPod Setup for hoshi-trans

Run a powerful cloud GPU to translate with a large model instead of your local GPU.

---

## Recommended GPU

| GPU | VRAM | Storage | Cost | Notes |
|-----|------|---------|------|-------|
| RTX 4090 | 24 GB | 60 GB+ | ~$0.79/h | Best choice |
| RTX 3090 | 24 GB | 60 GB+ | ~$0.29/h | Good value |
| RTX 4080 | 16 GB | 50 GB+ | ~$0.50/h | Works for 14B only |

**Storage:** minimum 50 GB (model ~20 GB + Ollama + system overhead).

---

## Step 1 — Create a Pod

1. Go to [runpod.io](https://www.runpod.io/) and create a new pod.
2. Choose a template: **RunPod Pytorch** or any Ubuntu/Debian base image.
3. Under **"Expose HTTP Ports"**, add port **`11434`**.
4. Add environment variable: `OLLAMA_HOST=0.0.0.0`

---

## Step 2 — Container Start Command

Choose one of the two options below and paste it in the **"Container Start Command"** field.

---

### Option A — Sugoi 14B Ultra Q8 (~16 GB VRAM)

Fine-tuned Qwen2.5-14B for JP→EN game/VN translation. Requires 24 GB VRAM.

```bash
bash -c "
apt update && apt install -y curl &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 30 &&
curl -f -L -o /tmp/hoshi-translator-14b-trans.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-14b-trans.Modelfile || exit 1 &&
ollama create hoshi-translator-14b-trans -f /tmp/hoshi-translator-14b-trans.Modelfile || exit 1 &&
echo 'hoshi-translator-14b-trans ready' &&
sleep infinity
"
```

---

### Option B — Sugoi 32B Ultra Q4 (~20 GB VRAM)

Fine-tuned Qwen2.5-32B for JP→EN game/VN translation. Best quality. Requires 24 GB VRAM.

```bash
bash -c "
apt update && apt install -y curl &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 30 &&
curl -f -L -o /tmp/hoshi-translator-32b-trans.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-32b-trans.Modelfile || exit 1 &&
ollama create hoshi-translator-32b-trans -f /tmp/hoshi-translator-32b-trans.Modelfile || exit 1 &&
echo 'hoshi-translator-32b-trans ready' &&
sleep infinity
"
```

---

## Step 3 — Get Your Pod URL

Once the pod is running, your Ollama URL is:

```
https://<POD_ID>-11434.proxy.runpod.net
```

Example: `https://kfgeaneoswl1fd-11434.proxy.runpod.net`

Find your Pod ID in the RunPod dashboard.

---

## Step 4 — Configure in hoshi-trans

In hoshi-trans, go to **Settings → Ollama Connection** and enter:

```
https://<POD_ID>-11434.proxy.runpod.net
```

Click **Save**. The app will reconnect automatically.

Or, if Ollama is shown as offline, enter the URL directly on the waiting screen and click **Connect**.

---

## Notes

- The pod takes ~5–10 minutes to be fully ready (model download included).
- Stop the pod when not translating to avoid unnecessary charges.
- The model is automatically recreated from the latest Modelfile on each pod start.
- Ollama downloads the base GGUF from HuggingFace automatically when running `ollama create`.
