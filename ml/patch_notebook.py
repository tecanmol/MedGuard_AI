"""
Patches medguard_kaggle_training_dermacon.ipynb in-place to fix 3 issues:
  1. Missing class_weight fallback for absent classes
  2. KeyError if DermaCon-IN lacks a 'fitzpatrick' column
  3. OOM risk from loading all val images into RAM at once
Run:  python ml/patch_notebook.py
"""
import json, re, os

NB_PATH = os.path.join(os.path.dirname(__file__), 'medguard_kaggle_training_dermacon.ipynb')

with open(NB_PATH, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] != 'code':
        continue
    src = ''.join(cell['source'])

    # ── FIX 1: Add class_weight fallback after the dict comprehension ──────────
    old = "class_weight_dict = {int(l): float(w) for l,w in zip(unique_labels, weights)}\nprint('Class weights:', class_weight_dict)"
    new = (
        "class_weight_dict = {int(l): float(w) for l,w in zip(unique_labels, weights)}\n"
        "# Ensure ALL 5 classes have a weight — prevents Keras crash if a class has 0 samples\n"
        "for i in range(len(CLASSES)):\n"
        "    if i not in class_weight_dict:\n"
        "        class_weight_dict[i] = 1.0\n"
        "print('Class weights:', class_weight_dict)"
    )
    src = src.replace(old, new)

    # ── FIX 2: Safe DermaCon fitzpatrick access ────────────────────────────────
    old2 = "fitz = float(item['fitzpatrick'])"
    new2 = "fitz = float(item.get('fitzpatrick') or -1)"
    src = src.replace(old2, new2)

    # ── FIX 3: Replace load_images batched predict to avoid OOM ──────────────
    # Replace the naive "stack all at once" approach in Cell 8 with batched inference
    old3 = (
        "def load_images(paths):\n"
        "    imgs = []\n"
        "    valid_paths = []\n"
        "    for p in paths:\n"
        "        try:\n"
        "            b = tf.io.read_file(p)\n"
        "            img = tf.io.decode_image(b, channels=3, expand_animations=False)\n"
        "            img.set_shape([None,None,3])\n"
        "            img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])\n"
        "            imgs.append(tf.cast(img, tf.float32))\n"
        "            valid_paths.append(p)\n"
        "        except Exception as e:\n"
        "            print('Skipping:', p, e)\n"
        "    return tf.stack(imgs), valid_paths"
    )
    new3 = (
        "def predict_paths(paths, labels_lookup, batch_size=64):\n"
        "    \"\"\"Batched inference to avoid OOM on large val sets.\"\"\"\n"
        "    y_true, y_pred = [], []\n"
        "    for i in range(0, len(paths), batch_size):\n"
        "        batch_paths = paths[i:i+batch_size]\n"
        "        imgs = []\n"
        "        valid = []\n"
        "        for p in batch_paths:\n"
        "            try:\n"
        "                b = tf.io.read_file(p)\n"
        "                img = tf.io.decode_image(b, channels=3, expand_animations=False)\n"
        "                img.set_shape([None,None,3])\n"
        "                img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])\n"
        "                imgs.append(tf.cast(img, tf.float32))\n"
        "                valid.append(p)\n"
        "            except Exception as e:\n"
        "                print('Skipping:', p, e)\n"
        "        if not imgs:\n"
        "            continue\n"
        "        preds = model.predict(tf.stack(imgs), verbose=0)\n"
        "        y_pred.extend(np.argmax(preds, axis=1).tolist())\n"
        "        y_true.extend([int(labels_lookup[p]) for p in valid])\n"
        "    return y_true, y_pred"
    )
    src = src.replace(old3, new3)

    # Patch the call sites too
    src = src.replace(
        "val_imgs, valid_val_paths = load_images(val_paths)\n"
        "val_lookup = {p:int(y) for p,y in zip(val_paths,val_labels)}\n"
        "y_true_val = [val_lookup[p] for p in valid_val_paths]\n"
        "y_pred_val = np.argmax(model.predict(val_imgs, verbose=0), axis=1)",
        "val_lookup = {p:int(y) for p,y in zip(val_paths,val_labels)}\n"
        "y_true_val, y_pred_val = predict_paths(val_paths, val_lookup)"
    )
    src = src.replace(
        "dc_imgs, valid_dc_paths = load_images(dc_df['image_path'].tolist())\n"
        "    dc_lookup = dict(zip(dc_df['image_path'], dc_df['label']))\n"
        "    y_true_dc = [int(dc_lookup[p]) for p in valid_dc_paths]\n"
        "    y_pred_dc = np.argmax(model.predict(dc_imgs, verbose=0), axis=1)",
        "dc_lookup = dict(zip(dc_df['image_path'], dc_df['label'].astype(int)))\n"
        "    y_true_dc, y_pred_dc = predict_paths(dc_df['image_path'].tolist(), dc_lookup)"
    )

    # Write back
    cell['source'] = [src]

with open(NB_PATH, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Notebook patched successfully!")
print("Fixes applied:")
print("  1. class_weight fallback for absent classes")
print("  2. Safe DermaCon fitzpatrick field access")
print("  3. Batched prediction to prevent OOM in evaluation")

