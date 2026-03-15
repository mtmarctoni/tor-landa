import React from "react";

import StatusState from "@/components/StatusState";

const WaitingForQuality: React.FC = () => {
  return (
    <StatusState
      icon="⏳"
      title="¡Todavia no hay mensaje!"
      animatedTitle="Tú solo confía 😎"
      description={`Confía en el proceso. El universo (y el autor) están trabajando en ello.\n¡A veces lo mejor llega para quienes saben esperar!`}
      footerMessage={`Ten paciencia, ¡el próximo mensaje podría ser el mejor de todos!`}
      onAction={() => window.location.reload()}
      actionLabel="Volver a comprobar"
    />
  );
};

export default WaitingForQuality;
