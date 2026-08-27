type FormErrorAlertProps = {
  message: string;
};

export function FormErrorAlert({ message }: FormErrorAlertProps) {
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
