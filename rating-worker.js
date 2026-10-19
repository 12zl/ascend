/* A real, local vision-language model. Only model files cross the network. */
import "./rating-core.js?v=ai-20261019-3";
const MODELS = {
  fast: {
    id: "HuggingFaceTB/SmolVLM-500M-Instruct",
    revision: "a7da5b986cb59b408707209984f360a5f4ad7e47",
    bytes: 390471233,
    edge: 512,
  },
  ai: {
    id: "onnx-community/Qwen3-VL-2B-Instruct-ONNX",
    revision: "5dc9194ba42fa62c2f1440d98a71f7cd5280afe2",
    bytes: 1373092553,
    edge: 448,
  },
};
const RUNTIME =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.js";
const PROMPTS = {
  current:
    "Rate the facial attractiveness visible in this portrait from 1 to 100. Consider facial harmony, definition, eyes, skin appearance and grooming. Average is 50, exceptionally attractive is 90. Ignore clothing and background. Reply with only one integer.",
  potential:
    "Estimate facial attractiveness from 1 to 100 after realistic improvements to this person’s haircut, grooming and skincare. Keep their anatomy unchanged. Average is 50, exceptionally attractive is 90. Reply with only one integer.",
  advice:
    "Suggest two specific grooming improvements for this person’s visible face and hair. Be concrete. Write two short lines. Each line must have this format: Visible issue | Low or Medium or High | Practical grooming action. Do not suggest medical procedures.",
};
let modelPromise;
let active = false;
let notify = () => {};
async function load(config) {
  if (!modelPromise)
    modelPromise = (async () => {
      if (!navigator.gpu || !(await navigator.gpu.requestAdapter()))
        throw new Error(
          "This browser has no available WebGPU adapter. Use a recent Chrome or Edge with hardware acceleration, or choose measurements only.",
        );
      notify("Loading the browser AI runtime", 20);
      const {
        AutoProcessor,
        AutoModelForImageTextToText,
        RawImage,
        TextStreamer,
        env,
      } = await import(RUNTIME);
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // One WASM thread also works on static hosts without cross-origin isolation.
      env.backends.onnx.wasm.numThreads = 1;
      const files = new Map();
      const progress_callback = (p) => {
        if (p.status === "progress") {
          files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
          const loaded = [...files.values()].reduce((s, f) => s + f.loaded, 0);
          const total = [...files.values()].reduce((s, f) => s + f.total, 0);
          notify(
            `Downloading AI weights · ${(loaded / 1e6).toFixed(0)} MB${total ? " / " + (total / 1e6).toFixed(0) + " MB" : ""}`,
            20 + Math.min(45, (loaded / config.bytes) * 45),
          );
        } else if (p.status === "done")
          notify("Preparing cached AI weights", 65);
      };
      const options = { revision: config.revision, progress_callback };
      const processor = await AutoProcessor.from_pretrained(config.id, options);
      // A single 512px image avoids unnecessary high-resolution patch expansion.
      if (config.id.includes("Qwen3")) {
        processor.image_processor.min_pixels = 65536;
        processor.image_processor.max_pixels = 262144;
      } else {
        processor.image_processor.size = { longest_edge: config.edge };
        processor.image_processor.do_image_splitting = false;
      }
      const model = await AutoModelForImageTextToText.from_pretrained(
        config.id,
        {
          ...options,
          device: "webgpu",
          dtype: config.id.includes("Qwen3")
            ? "q4f16"
            : {
                embed_tokens: "fp16",
                vision_encoder: "q4",
                decoder_model_merged: "q4",
              },
        },
      );
      return { processor, model, RawImage, TextStreamer };
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  return modelPromise;
}
self.onmessage = async ({ data }) => {
  if (active) return;
  active = true;
  const { id, photo } = data;
  const config = MODELS[data.mode] || MODELS.ai;
  notify = (stage, percent) =>
    self.postMessage({
      id,
      type: "progress",
      stage,
      percent: Math.round(percent),
    });
  try {
    const { processor, model, RawImage, TextStreamer } = await load(config);
    notify("Reading the face crop on your GPU", 70);
    const image = await RawImage.fromBlob(photo);
    const responses = {};
    for (const [index, [key, text]] of Object.entries(PROMPTS).entries()) {
      const prompt = processor.apply_chat_template(
        [
          {
            role: "user",
            content: [{ type: "image" }, { type: "text", text }],
          },
        ],
        { add_generation_prompt: true },
      );
      const inputs = await processor(prompt, image, {
        do_image_splitting: false,
      });
      let count = 0;
      const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        callback_function: () => {},
        token_callback_function: () => {
          count++;
          if (count % 8 === 0)
            notify(
              key === "advice"
                ? "AI is writing grooming suggestions · " + count + " tokens"
                : "AI is estimating " + key,
              72 + index * 8 + Math.min(7, (count / 150) * 7),
            );
        },
      });
      notify(
        key === "advice"
          ? "Reading visible grooming details"
          : "AI is estimating " + key,
        72 + index * 8,
      );
      const outputs = await model.generate({
        ...inputs,
        max_new_tokens: key === "advice" ? 180 : 12,
        do_sample: false,
        repetition_penalty: 1.05,
        streamer,
      });
      const generated = outputs.tolist()[0].slice(inputs.input_ids.dims.at(-1));
      responses[key] = processor.tokenizer
        .decode(generated, { skip_special_tokens: true })
        .trim();
    }
    const raw = JSON.stringify(responses, null, 2);
    let rating;
    try {
      rating = self.AscendRating.parseOutputs(responses);
    } catch (error) {
      self.postMessage({ id, type: "error", message: error.message, raw });
      return;
    }
    self.postMessage({
      id,
      type: "result",
      rating: {
        ...rating,
        model: config.id,
        revision: config.revision,
        rubric: self.AscendRating.RUBRIC,
        raw,
        device: "webgpu",
      },
    });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: "Browser AI: " + (error.message || String(error)),
    });
  } finally {
    active = false;
  }
};
