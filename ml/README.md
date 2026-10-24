# MedGuard AI — Dataset Download Instructions

Once downloaded, **all datasets must be placed in `ml/data/` following the folder structure below**, then run `python format_data.py` to generate the unified `metadata.csv`.

```
ml/
└── data/
    ├── fitzpatrick17k/    ← Fitzpatrick17k images (from Kaggle)
    ├── derma_con_in/      ← DermaCon-IN images (from Harvard Dataverse)
    ├── dfu/               ← Diabetic Foot Ulcer images (from Kaggle)
    ├── scin/              ← SCIN images (from Kaggle)
    └── metadata.csv       ← Auto-generated after running format_data.py
```

---

## 1. Fitzpatrick17k (General Dermatology & Skin Tones)

**What it covers:** 114 skin conditions (melanoma, eczema, psoriasis, fungal infections), ~16k images with FST I–VI labels.

**Steps:**
1. Go to: https://www.kaggle.com/datasets/gauravduttakiit/fitzpatrick17k
2. Download the ZIP and extract the **images folder** contents into `ml/data/fitzpatrick17k/`.
3. The metadata CSV is handled automatically by our pipeline.

---

## 2. SCIN Dataset (Diverse Eczema, Psoriasis, FST representation)

**What it covers:** 10,000+ volunteer-contributed images of common conditions. **Includes rich Fitzpatrick and Monk Skin Tone labels.**

**Steps:**
1. Go to: https://www.kaggle.com/datasets/nikita2998/scin-dataset
2. Download the ZIP file.
3. Extract the images and place them into `ml/data/scin/`.
4. Ensure the included SCIN metadata CSV file is also placed in `ml/data/scin/` so our script can read the FST labels.

---

## 3. Diabetic Foot Ulcer (DFU)

**What it covers:** ~1,055 images containing normal/healthy feet and abnormal diabetic foot ulcers. (Note: No skin tone metadata is included, so the pipeline will assign them a neutral weight).

**Steps:**
1. Go to: https://www.kaggle.com/datasets/laithjj/diabetic-foot-ulcer-dfu
2. Download the ZIP file.
3. Extract the contents. You will find folders separated by class (e.g., `Normal`, `Abnormal`). 
4. Move those class folders directly into `ml/data/dfu/`.

---

## 4. DermaCon-IN (Indian Skin Tones & Fungal/Eczema focus)

**What it covers:** 5,450 clinical images of 245 skin diagnoses from patients in South India. Uses both 6-level FST and 10-level Monk Skin Tone scales.

**Steps:**
1. Go to: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/DBK8YV
2. Click **Access Dataset** → **Download ZIP** (no login required).
3. Extract and copy the images into `ml/data/derma_con_in/`.

---

## After All Downloads — Run the Formatter

Once you have the datasets downloaded into their respective folders, run:

```bash
cd ml
python format_data.py
```

This will scan all dataset folders, map their labels to our 6 disease classes, apply fairness weighting, and generate the unified `ml/data/metadata.csv` ready for training.

Then run:

```bash
python train.py
```

