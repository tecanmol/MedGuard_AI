# MedGuard AI Models Directory

This directory contains the edge ML models used by the app for inference.

## Required Models

### `medguard_v3.tflite` (MedGuard v3.2 Dual-Branch Model)
The app expects the main TFLite inference model to be placed at this exact path.
This model is exported from the `medguard-3-2-fixed (1).ipynb` training notebook.

- **Architecture:** Dual-branch (EfficientNetB0 + ResNet50V2 fused)
- **Input:** 224x224 RGB float32 [0-255] (No external normalization needed)
- **Output:** Softmax probabilities over 6 classes

> **Note:** The `*.tflite` files are large and usually ignored by Git. You must manually copy the exported model from Kaggle into this directory before building the app.

## Policy Calibration
The model outputs are calibrated and mapped to decisions using parameters defined in `medguard_policy.json` (also from the notebook). These parameters are hardcoded into `src/services/ai-inference.ts`. If you train a new model version and the policy parameters (like temperature, thresholds) change, you must update them in the code.

