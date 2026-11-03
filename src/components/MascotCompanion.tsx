export type MascotExpression =
  | "neutral"
  | "welcome"
  | "celebration"
  | "alert"
  | "approval"
  | "encouragement";

const poses: Record<MascotExpression, { image: string; label: string }> = {
  neutral: { image: "neutra.png", label: "pose neutra" },
  welcome: { image: "boas-vindas.png", label: "acenando em boas-vindas" },
  celebration: { image: "comemoracao.png", label: "comemorando" },
  alert: { image: "alerta.png", label: "alerta" },
  approval: { image: "aprovacao.png", label: "aprovando com joinha" },
  encouragement: { image: "encorajamento.png", label: "encorajando" },
};

export function MascotCompanion({
  expression,
  message,
}: {
  expression: MascotExpression;
  message: string;
}) {
  const pose = poses[expression];

  return (
    <div className="mascot-companion" role="img" aria-label={`Mascote Fluxary: ${pose.label}. ${message}`}>
      <img
        className="mascot-companion-image"
        src={`/mascotes/${pose.image}`}
        alt=""
        width={183}
        height={165}
        loading="eager"
      />
    </div>
  );
}
