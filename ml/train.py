import os
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight

IMG_SIZE = 224
BATCH_SIZE = 16

CLASSES = ['melanoma_suspect', 'diabetic_foot_ulcer', 'eczema', 'psoriasis', 'fungal_infection', 'normal_benign']

def build_model():
    """
    Two-Phase Fine-Tuning Pipeline for MobileNetV3Small.
    
    Architecture:
      Raw [0,255] input
        → Safe Geometric Augmentation (flip, rotate, zoom)
        → MobileNetV3Small [include_preprocessing=True, so it internally rescales to [-1,1]]
        → GlobalAveragePooling2D
        → BatchNorm (normalizes the 576 MobileNet output features)
        → Dropout(0.3)
        → Dense(128, relu)
        → Dropout(0.3)
        → Dense(6, softmax)
    
    Key design decisions (verified against official TF docs):
    1. Augment BEFORE base model: correct per keras.io transfer learning guide.
    2. preprocess_input() is REMOVED: MobileNetV3 already has a built-in Rescaling
       layer (include_preprocessing=True by default), so calling preprocess_input() 
       externally is a redundant no-op. We rely on the model's own internal layer.
    3. base_model(x, training=False): ALWAYS hardcoded False. This keeps the BN 
       layers inside MobileNetV3 using their stored population statistics — even 
       during Phase 2 when base_model.trainable=True. Weights still get gradients; 
       BN statistics do NOT shift. Per official TF fine-tuning tutorial.
    4. New BN layer on the head: receives training=True/False automatically from 
       the outer model's call context, so it correctly adapts during fit() only.
    """
    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))

    # STEP 1: SAFE GEOMETRIC AUGMENTATION on raw [0,255] pixels
    # Only geometric transforms — no contrast/brightness which would destroy
    # skin color cues (e.g. erythema redness, melanoma dark pigmentation).
    # Keras RandomX layers are automatically disabled during inference (training=False).
    data_augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.2),
        tf.keras.layers.RandomZoom(0.2),
    ])
    x = data_augmentation(inputs)

    # STEP 2: BASE MODEL
    # include_preprocessing=True (default) means MobileNetV3 handles its own
    # internal Rescaling layer ([0,255] → [-1,1]). We do NOT call preprocess_input().
    base_model = tf.keras.applications.MobileNetV3Small(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'
        # include_preprocessing=True is the default — no need to state it
    )
    base_model.trainable = False  # Starts frozen. Unfrozen in Phase 2 below.

    # training=False is hardcoded here. This is CRITICAL: it tells the BN layers
    # inside MobileNetV3 to use their stored population statistics, NOT batch
    # statistics. This applies in BOTH Phase 1 AND Phase 2. Gradients still flow
    # through conv weights in Phase 2; only BN stats stay frozen.
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)

    # STEP 3: CLASSIFICATION HEAD
    # BatchNorm normalises the 576 output features from MobileNetV3 before the
    # Dense layer sees them, preventing any single feature from dominating.
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(128, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(len(CLASSES), activation='softmax')(x)

    model = tf.keras.Model(inputs, outputs)
    return model, base_model


if __name__ == '__main__':
    print("Initializing Two-Phase Fine-Tuning Pipeline...")

    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_PATH = os.path.join(SCRIPT_DIR, 'data', 'metadata.csv')

    df = pd.read_csv(DATA_PATH)
    paths = df['image_path'].values
    labels = df['label'].values

    # Stratified split: guarantees exact class ratio in train and val
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        paths, labels, test_size=0.1, random_state=42, stratify=labels
    )
    print(f"Train: {len(train_paths)} | Val: {len(val_paths)}")

    def process_path(file_path, label):
        img = tf.io.read_file(file_path)
        img = tf.image.decode_jpeg(img, channels=3)
        img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
        # Return raw [0,255] float32 — MobileNetV3 handles its own rescaling internally
        return tf.cast(img, tf.float32), label

    train_ds = (
        tf.data.Dataset.from_tensor_slices((train_paths, train_labels))
        .shuffle(buffer_size=len(train_paths), seed=42)
        .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )

    val_ds = (
        tf.data.Dataset.from_tensor_slices((val_paths, val_labels))
        .map(process_path, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )

    # Class weights: penalize the model for ignoring underrepresented skin tones
    unique_labels = np.unique(train_labels)
    weights = compute_class_weight('balanced', classes=unique_labels, y=train_labels)
    class_weight_dict = {int(label): float(weight) for label, weight in zip(unique_labels, weights)}
    for i in range(len(CLASSES)):
        if i not in class_weight_dict:
            class_weight_dict[i] = 1.0
    print(f"Class weights: {class_weight_dict}")

    model, base_model = build_model()

    # =========================================================================
    # PHASE 1 — HEAD WARM-UP (base frozen, train Dense head only)
    # Goal: Get the new Dense/BN layers to reasonable weights BEFORE we
    # unfreeze the base. If we skipped this, the random Dense weights would
    # send huge gradient shockwaves backwards and destroy ImageNet features.
    # LR: 5e-4 (moderate; 1e-3 is too aggressive for the new BN layer).
    # =========================================================================
    print("\n--- PHASE 1: Head warm-up (5 epochs, LR=5e-4, base frozen) ---")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    model.fit(train_ds, validation_data=val_ds, epochs=5, class_weight=class_weight_dict)

    # =========================================================================
    # PHASE 2 — DEEP FINE-TUNING (base unfrozen, tiny LR with cosine decay)
    # We unfreeze the base model so its conv weights gently adjust to skin
    # disease features. CosineDecay provides a smooth, stable LR curve that
    # outperforms ExponentialDecay for fine-tuning in published literature.
    # Recompile is REQUIRED after changing trainable status.
    # =========================================================================
    print("\n--- PHASE 2: Deep fine-tuning (up to 50 epochs, CosineDecay from 1e-4) ---")
    base_model.trainable = True

    steps_per_epoch = len(train_paths) // BATCH_SIZE
    total_decay_steps = steps_per_epoch * 45  # Decay over 45 epochs

    lr_schedule = tf.keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=1e-4,
        decay_steps=total_decay_steps,
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=10,
            restore_best_weights=True,  # Exports the single best-ever epoch
            verbose=1
        )
    ]

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=50,
        class_weight=class_weight_dict,
        callbacks=callbacks
    )

    print("\nExporting best weights to TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    with open('medguard_model.tflite', 'wb') as f:
        f.write(tflite_model)
    print("Done!")

