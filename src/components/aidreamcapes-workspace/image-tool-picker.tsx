"use client";

import styles from "./image-tool-picker.module.css";

export type WorkspaceImageTool =
  | "custom"
  | "white-background"
  | "change-background"
  | "lifestyle-photos"
  | "model-photos";

export type ImageToolPickerProps = {
  value: WorkspaceImageTool;
  onChange: (value: WorkspaceImageTool) => void;
  disabled?: boolean;
};

const options: Array<{ value: WorkspaceImageTool; label: string; hint: string }> = [
  { value: "custom", label: "Custom image", hint: "Create an image from your description." },
  { value: "white-background", label: "White background", hint: "Place your product on a clean white background." },
  { value: "change-background", label: "Change background", hint: "Show your product in a different setting." },
  { value: "lifestyle-photos", label: "Lifestyle photo", hint: "Choose a lifestyle setting for your product image." },
  { value: "model-photos", label: "Model photo", hint: "Create a product image with a model in the scene." },
];

export function ImageToolPicker({ value, onChange, disabled = false }: ImageToolPickerProps) {
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>Choose an image style</legend>
      <p className={styles.note}>Background and photo options use a product photo as a reference.</p>
      <div className={styles.options}>
        {options.map((option) => (
          <label className={`${styles.option} ${value === option.value ? styles.selected : ""}`} key={option.value}>
            <input
              className={styles.radio}
              type="radio"
              name="workspace-image-tool"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.radioMark} aria-hidden="true" />
            <span className={styles.content}>
              <span className={styles.label}>{option.label}</span>
              <span className={styles.hint}>{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
