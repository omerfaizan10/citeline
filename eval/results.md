# Citeline retrieval evaluation

Run against `http://localhost:3000` on 2026-09-22T11:45:03.427174+00:00.

- **Top-1 accuracy:** 23/30 (77%) -- the expected paper was the single closest match
- **Top-K accuracy:** 27/30 (90%) -- the expected paper appeared anywhere in the citations shown
- **Average latency:** 2.7s per question
- **Errors:** 0

| # | Question | Expected | Result | Latency |
|---|----------|----------|--------|---------|
| 1 | What is the core innovation of the Transformer architecture? | `1706.03762` | 🟡 top-k | 2.7s |
| 2 | How does BERT's masked language modeling pretraining objective work? | `1810.04805` | ❌ miss | 3.0s |
| 3 | What does LoRA freeze, and what does it train instead? | `2106.09685` | 🟡 top-k | 1.6s |
| 4 | How does RAG combine a retriever with a generator model? | `2005.11401` | ✅ top-1 | 3.4s |
| 5 | What problem do residual connections in ResNet solve? | `1512.03385` | ✅ top-1 | 2.2s |
| 6 | How does U-Net use skip connections for biomedical image segmentation? | `1505.04597` | ✅ top-1 | 1.9s |
| 7 | How does the Vision Transformer (ViT) apply the Transformer architectu… | `2010.11929` | ✅ top-1 | 3.0s |
| 8 | What contrastive objective does CLIP use to connect images and text? | `2103.00020` | ✅ top-1 | 2.4s |
| 9 | What is the forward diffusion process in DDPM? | `2006.11239` | ❌ miss | 2.6s |
| 10 | How does the GAN framework set up a minimax game between generator and… | `1406.2661` | 🟡 top-k | 2.7s |
| 11 | What is the reparameterization trick used in the VAE paper? | `1312.6114` | 🟡 top-k | 3.0s |
| 12 | How does word2vec learn word embeddings from context? | `1301.3781` | ❌ miss | 2.4s |
| 13 | What does the Adam optimizer combine from AdaGrad and RMSProp? | `1412.6980` | ✅ top-1 | 2.5s |
| 14 | What internal covariate shift problem does Batch Normalization address… | `1502.03167` | ✅ top-1 | 2.2s |
| 15 | How does chain-of-thought prompting improve reasoning in large languag… | `2201.11903` | ✅ top-1 | 3.5s |
| 16 | What is RLHF, and how does InstructGPT use it? | `2203.02155` | ✅ top-1 | 3.2s |
| 17 | How does GraphSAGE generate embeddings for nodes not seen during train… | `1706.02216` | ✅ top-1 | 2.4s |
| 18 | What attention mechanism do Graph Attention Networks use over graph ne… | `1710.10903` | ✅ top-1 | 2.4s |
| 19 | How does wav2vec 2.0 learn speech representations without labels? | `2006.11477` | ✅ top-1 | 3.1s |
| 20 | What training data scale does Whisper use for robust speech recognitio… | `2212.04356` | ✅ top-1 | 1.8s |
| 21 | How does SimCLR construct positive pairs for contrastive learning? | `2002.05709` | ✅ top-1 | 2.1s |
| 22 | What does Momentum Contrast (MoCo) use a queue and momentum encoder fo… | `1911.05722` | ✅ top-1 | 2.4s |
| 23 | How does Proximal Policy Optimization clip the objective to constrain … | `1707.06347` | ✅ top-1 | 3.6s |
| 24 | What does Grad-CAM use to produce visual explanations for CNN predicti… | `1610.02391` | ✅ top-1 | 2.5s |
| 25 | How does SHAP unify different feature attribution methods? | `1705.07874` | ✅ top-1 | 3.0s |
| 26 | What is the key idea behind FlashAttention's IO-aware algorithm? | `2205.14135` | ✅ top-1 | 2.5s |
| 27 | How does QLoRA combine quantization with LoRA fine-tuning? | `2305.14314` | ✅ top-1 | 3.1s |
| 28 | What does the Switch Transformer route tokens to? | `2101.03961` | ✅ top-1 | 2.1s |
| 29 | How does Megatron-LM split a model's training across GPUs? | `1909.08053` | ✅ top-1 | 4.1s |
| 30 | What does the Scaling Laws paper find about the relationship between m… | `2001.08361` | ✅ top-1 | 4.0s |

## Misses

- **How does BERT's masked language modeling pretraining objective work?** -- expected `1810.04805`, got ['1907.11692', '1906.08237', '2003.10555', '2006.11477']
- **What is the forward diffusion process in DDPM?** -- expected `2006.11239`, got ['2010.02502', '2102.09672', '1910.02054']
- **How does word2vec learn word embeddings from context?** -- expected `1301.3781`, got ['1310.4546', '1810.04805', '1901.02860', '1607.04606', '1606.04080']
