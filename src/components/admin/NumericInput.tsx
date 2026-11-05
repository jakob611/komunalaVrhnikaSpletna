import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & { value: number; onValueChange: (value: number) => void };
/** Preserve temporary editing text instead of turning a cleared amount into 0. */
export default function NumericInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((previous) =>
      previous !== "" && Number(previous) === value ? previous : String(value),
    );
  }, [value]);
  return (
    <input
      {...props}
      type="number"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next !== "" && Number.isFinite(Number(next)))
          onValueChange(Number(next));
      }}
      onBlur={(event) => {
        if (text === "" || !Number.isFinite(Number(text)))
          setText(String(value));
        onBlur?.(event);
      }}
    />
  );
}
