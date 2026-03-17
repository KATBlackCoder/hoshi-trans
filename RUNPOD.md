# RunPod Setup for hoshi-trans

Run a powerful cloud GPU to translate with `hoshi-translator` (30B MoE model) instead of your local GPU.

---

## Recommended GPU

| GPU | VRAM | Storage | Cost | Notes |
|-----|------|---------|------|-------|
| RTX 4090 | 24 GB | 60 GB+ | ~$0.79/h | Best choice |
| RTX 3090 | 24 GB | 60 GB+ | ~$0.29/h | Good value |
| RTX 4080 | 16 GB | 50 GB+ | ~$0.50/h | Works, less margin |

**Storage:** minimum 50 GB (model ~20 GB + Ollama + system overhead).

---

## Step 1 — Create a Pod

1. Go to [runpod.io](https://www.runpod.io/) and create a new pod.
2. Choose a template: **RunPod Pytorch** or any Ubuntu/Debian base image.
3. Under **"Expose HTTP Ports"**, add port **`11434`**.
4. Add environment variable: `OLLAMA_HOST=0.0.0.0`

---

## Step 2 — Container Start Command

Paste this command in the **"Container Start Command"** field:

```bash
bash -c "
apt update && apt install -y curl lshw zstd &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M &&
curl -f -L -o /tmp/hoshi-translator-30b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile || exit 1 &&
ollama create hoshi-translator -f /tmp/hoshi-translator-30b.Modelfile || exit 1 &&
echo 'hoshi-translator 30B ready' &&
sleep infinity
"
```

This will:
1. Install Ollama with `zstd` support
2. Bind Ollama to all interfaces (`OLLAMA_HOST=0.0.0.0`)
3. Pull `huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M`
4. Download and create the `hoshi-translator` custom model from this repo

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
- The `hoshi-translator` model is automatically recreated from the latest Modelfile on each pod start.
