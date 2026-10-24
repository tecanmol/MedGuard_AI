import os
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(SCRIPT_DIR, 'data', 'metadata.csv')
MODEL_PATH = os.path.join(SCRIPT_DIR, '..', 'medguard_model.tflite')

IMG_SIZE = 224

# 5 classes (fungal_infection removed)
CLASSES = [
    'melanoma_suspect',
    'diabetic_foot_ulcer',
    'eczema',
    'psoriasis',
    'normal_benign',
]

def load_and_preprocess(img_path):
    img = tf.io.read_file(img_path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
    # Raw [0,255] float32 — model handles its own internal rescaling
    img = tf.cast(img, tf.float32)
    img = tf.expand_dims(img, 0)
    return img


def evaluate():
    if not os.path.exists(MODEL_PATH):
        print(f"Error: Could not find model at {MODEL_PATH}")
        print("Run train.py first to generate medguard_model.tflite!")
        return

    print("Loading TFLite model...")
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print("Loading metadata...")
    df = pd.read_csv(DATA_PATH)

    # Sanity check — make sure labels are in the 0-4 range
    assert df['label'].max() <= 4, "Labels not remapped! Run ml/remap_labels.py first."

    df_known = df[df['fitzpatrick'] > 0]
    print(f"Total images with known skin tones: {len(df_known)}")

    buckets = {
        "Fair/Light Skin  (Fitzpatrick I-II)":   df_known[df_known['fitzpatrick'].isin([1, 2])],
        "Indian/Brown Skin (Fitzpatrick III-IV)": df_known[df_known['fitzpatrick'].isin([3, 4])],
        "Dark Skin        (Fitzpatrick V-VI)":   df_known[df_known['fitzpatrick'].isin([5, 6])],
    }

    print("\n=======================================================")
    print(" MEDGUARD AI - SKIN TONE FAIRNESS EVALUATION REPORT")
    print("=======================================================\n")

    for group_name, df_group in buckets.items():
        total = len(df_group)
        if total == 0:
            print(f"{group_name}: No data available.\n")
            continue

        print(f"Evaluating {group_name} ({total} images)...")

        y_true, y_pred = [], []
        sample_size = min(300, total)
        df_sample = df_group.sample(sample_size, random_state=42)

        for _, row in df_sample.iterrows():
            try:
                img_tensor = load_and_preprocess(row['image_path'])
                interpreter.set_tensor(input_details[0]['index'], img_tensor)
                interpreter.invoke()
                preds = interpreter.get_tensor(output_details[0]['index'])
                y_true.append(int(row['label']))
                y_pred.append(int(np.argmax(preds)))
            except Exception:
                pass

        if not y_true:
            print("   => No images could be processed.\n")
            continue

        acc  = accuracy_score(y_true, y_pred) * 100
        prec = precision_score(y_true, y_pred, average='macro', zero_division=0) * 100
        rec  = recall_score(y_true, y_pred, average='macro', zero_division=0) * 100
        f1   = f1_score(y_true, y_pred, average='macro', zero_division=0) * 100

        print(f"   => Accuracy:  {acc:.2f}%")
        print(f"   => Precision: {prec:.2f}%")
        print(f"   => Recall:    {rec:.2f}%")
        print(f"   => F1 Score:  {f1:.2f}%\n")

    # --- OVERALL PER-CLASS BREAKDOWN ---
    print("=======================================================")
    print(" OVERALL PER-CLASS PERFORMANCE (all skin tones)")
    print("=======================================================\n")

    sample_size = min(500, len(df))
    df_all = df.sample(sample_size, random_state=42)
    y_true_all, y_pred_all = [], []

    for _, row in df_all.iterrows():
        try:
            img_tensor = load_and_preprocess(row['image_path'])
            interpreter.set_tensor(input_details[0]['index'], img_tensor)
            interpreter.invoke()
            preds = interpreter.get_tensor(output_details[0]['index'])
            y_true_all.append(int(row['label']))
            y_pred_all.append(int(np.argmax(preds)))
        except Exception:
            pass

    print(classification_report(
        y_true_all, y_pred_all,
        target_names=CLASSES,
        zero_division=0
    ))

    print("=======================================================")
    print("Fairness check: gap between groups should be < 5%.")
    print("=======================================================")


if __name__ == "__main__":
    evaluate()

