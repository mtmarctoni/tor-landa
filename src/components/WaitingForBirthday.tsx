import React from "react";

import StatusState from "@/components/StatusState";

const WaitingForBirthday: React.FC = () => {
  return (
    <StatusState
      icon="🎁"
      title="Algo especial esta por abrirse"
      description="Vuelve el 23 de octubre"
      tone="celebration"
    />
  );
};

export default WaitingForBirthday;
