import { useId } from "react";
import type { IpadCountdownModel } from "@/utils/ipadCountdown";

export interface IpadPromiseCertificateProps {
  model: IpadCountdownModel;
  variant: "full" | "compact";
}

/** A promise receipt, never a parcel or a claim that something has shipped. */
export default function IpadPromiseCertificate({
  model,
  variant,
}: IpadPromiseCertificateProps) {
  const titleId = useId();
  const { content, remaining } = model;
  const heading =
    content === "purchased"
      ? "Comprado. El departamento puede respirar."
      : content === "shopping-open"
        ? "Se abre el plazo de cumplir la promesa."
        : content === "invalid"
          ? "La promesa sigue en pie."
          : variant === "full"
            ? "Tu iPad no se ha perdido."
            : "Lo del iPad sigue en pie. El reloj, no.";
  const body =
    content === "purchased"
      ? "Tu iPad ya está comprado."
      : content === "shopping-open"
        ? `${model.isTargetDay ? "Hoy toca buscar tu iPad." : "Ya podemos buscar tu iPad."} El pez no garantiza ofertas, pero yo no me he olvidado.`
        : content === "invalid"
          ? "El reloj está de papeleo."
          : variant === "full"
            ? "He prometido un iPad. El tiempo ha presentado una reclamación."
            : null;
  return (
    <section
      className={`ipad-promise ipad-promise--${variant}`}
      aria-label="Departamento de Promesas Pendientes"
      data-ipad-state={content}
    >
      <div className="ipad-promise-scenery" aria-hidden="true">
        <svg
          className="ipad-promise-clock"
          viewBox="0 0 120 165"
          aria-hidden="true"
        >
          <path
            d="M12 53C-7-7 115-8 106 57L98 135Q91 167 76 140L67 104Q17 139 12 53Z"
            fill="#ffe582"
            stroke="#492752"
            strokeWidth="3"
          />
          <ellipse
            cx="59"
            cy="53"
            rx="37"
            ry="39"
            fill="#fff8e8"
            stroke="#492752"
            strokeWidth="2"
          />
          <path
            d="M59 21V27M28 53H34M84 53H90M59 80V86"
            stroke="#492752"
            strokeWidth="3"
          />
          <path
            d="M59 31V53L80 63"
            fill="none"
            stroke="#a92059"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M24 117L10 139M94 139L111 155"
            stroke="#492752"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <svg
          className="ipad-promise-fish"
          viewBox="0 0 230 180"
          aria-hidden="true"
        >
          <path
            d="M61 70Q14 7 32 21L70 49M114 47L148 9L152 58"
            fill="#fff3cd"
            stroke="#492752"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M33 77Q94 19 158 73L204 44L191 82L208 110L159 97Q88 144 33 77Z"
            fill="#fa967f"
            stroke="#492752"
            strokeWidth="3"
          />
          <ellipse
            cx="66"
            cy="76"
            rx="12"
            ry="17"
            fill="#fff9de"
            stroke="#492752"
            strokeWidth="2"
          />
          <ellipse cx="62" cy="80" rx="4" ry="7" fill="#492752" />
          <path
            d="M40 91L25 95M108 70L119 88L110 101M143 63L151 83L143 102M97 113L101 143M150 106L148 138"
            fill="none"
            stroke="#492752"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M74 139L173 134L179 171L80 176Z"
            fill="#fff3cd"
            stroke="#492752"
            strokeWidth="2"
          />
          <text
            x="126"
            y="158"
            textAnchor="middle"
            fill="#492752"
            fontSize="11"
            fontFamily="Georgia, serif"
          >
            NO ES EL iPad
          </text>
        </svg>
        <span className="ipad-promise-thread" />
      </div>
      <div className="ipad-promise-paper">
        <p className="journal-eyebrow ipad-promise-eyebrow">
          Departamento de Promesas Pendientes{" "}
          <span>Exp. IP-01 · Correos imposibles</span>
        </p>
        <h3 id={titleId} className="ipad-promise-title">
          {heading}
        </h3>
        {body && <p className="ipad-promise-body">{body}</p>}
        {content === "pending" && remaining && (
          <p
            className="ipad-promise-time"
            data-ipad-timer=""
            aria-describedby={titleId}
          >
            <strong>
              {remaining.days} {remaining.days === 1 ? "día" : "días"},{" "}
              {remaining.hours} {remaining.hours === 1 ? "hora" : "horas"} y{" "}
              {remaining.minutes}{" "}
              {remaining.minutes === 1 ? "minuto" : "minutos"}
            </strong>{" "}
            <span>para salir a buscarlo.</span>
          </p>
        )}
        <div className="ipad-promise-bottom">
          <span className="ipad-promise-seal">
            {content === "purchased" ? "COMPRADO" : "PROMETIDO. NO OLVIDADO."}
          </span>
          {content === "pending" && (
            <p className="ipad-promise-date">
              {model.targetLabel}
              <br />
              Esperamos ofertas. No las fabricamos.
            </p>
          )}
        </div>
        {variant === "full" && (
          <p className="ipad-promise-aside">
            «Yo reparto cartas. Lo de las compras no venía en mi contrato.»{" "}
            <span>— El pez, testigo involuntario</span>
          </p>
        )}
      </div>
      <div className="ipad-promise-drawer" aria-hidden="true">
        <span />
        Prohibido archivar el cariño.
      </div>
    </section>
  );
}
