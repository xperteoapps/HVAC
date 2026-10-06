import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    position="top-right"
    richColors
    closeButton
    toastOptions={{ classNames: { toast: "font-sans" } }}
    {...props}
  />
);

export { Toaster, toast };
