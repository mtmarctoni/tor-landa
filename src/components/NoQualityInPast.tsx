import React from "react";

import StatusState from "@/components/StatusState";

const NoQualityInPast: React.FC = () => {
  return (
    <StatusState
      icon="📅"
      title="¡Ups! Semana sin mensaje..."
      animatedTitle="Ni el oráculo lo vio venir 😅"
      description={`Esta semana ya pasó y el mensaje se fue de vacaciones.\n¡Pero no te preocupes! La próxima semana seguro trae algo especial.`}
      footerMessage={`Los errores son historia, los mensajes son eternos.\n(A no ser que se caiga esta página, claro)`}
    />
  );
};

export default NoQualityInPast;
