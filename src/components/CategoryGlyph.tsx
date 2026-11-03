import { Siren } from "lucide-react";

// Apresenta emoji ou o símbolo vetorial do Pix nas listas de categorias.
export function CategoryGlyph({ icon, size = 17 }: { icon: string; size?: number }) {
  if (icon === "pix") {
    return (
      <svg aria-label="Pix" role="img" width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="m11.2 4.5 4.8 4.8 4.8-4.8a3.6 3.6 0 0 0-5.1 0l-.4.4-.4-.4a3.6 3.6 0 0 0-3.7 0Z" fill="currentColor" />
        <path d="m4.5 11.2 4.8 4.8-4.8 4.8a3.6 3.6 0 0 1 0-5.1l.4-.4-.4-.4a3.6 3.6 0 0 1 0-3.7Z" fill="currentColor" />
        <path d="m27.5 11.2-4.8 4.8 4.8 4.8a3.6 3.6 0 0 0 0-5.1l-.4-.4.4-.4a3.6 3.6 0 0 0 0-3.7Z" fill="currentColor" />
        <path d="m11.2 27.5 4.8-4.8 4.8 4.8a3.6 3.6 0 0 1-5.1 0l-.4-.4-.4.4a3.6 3.6 0 0 1-3.7 0Z" fill="currentColor" />
        <path d="m11.3 16 4.7-4.7 4.7 4.7-4.7 4.7-4.7-4.7Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "emergency") return <Siren size={size} aria-label="Emergência" />;
  return <span aria-hidden="true">{icon}</span>;
}
