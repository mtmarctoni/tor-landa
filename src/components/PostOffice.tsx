"use client";

import type { ReactNode } from "react";
import LunarDepartment from "@/components/LunarDepartment";
import usePostalDelivery from "@/components/usePostalDelivery";
import "./post-office.css";
import "./postal-delivery.css";

interface PostOfficeProps {
  week: number;
  year: number;
  direction: number;
  delivered: boolean;
  randomCue: number;
  children: ReactNode;
}

/** Only the real cargo remounts. Lunar memory and the focused skip button survive. */
export default function PostOffice({
  week,
  year,
  direction,
  delivered,
  randomCue,
  children,
}: PostOfficeProps) {
  const delivery = usePostalDelivery(`${year}-${week}-${randomCue}`, delivered);
  return (
    <section
      className="postal-scene"
      data-testid="post-office"
      data-direction={direction}
      data-delivered={delivered}
      data-phase={delivery.phase}
      data-running={delivery.running}
      data-opened={delivery.opened}
      data-stamped={delivery.stamped}
      aria-label="La oficina de correos imposibles de Landa"
    >
      <div className="postal-sign">
        <span>Correos imposibles</span>
        <em>Sucursal Landa · solo cartas que te quieren</em>
      </div>
      <div className="postal-cargo" key={delivery.identity}>
        <div className="postal-airmail" aria-hidden="true">
          <svg aria-hidden="true" className="postal-rig">
            <line x1="110" y1="60" x2="4" y2="100%" />
            <line x1="110" y1="60" x2="100%" y2="100%" />
          </svg>
          <svg
            aria-hidden="true"
            className="postal-fish"
            data-laboratory-character="flying-fish"
            viewBox="0 0 210 130"
          >
            <path
              d="M89 65Q32 -21 39 27Q4 1 28 39Q-3 23 23 56L77 84M111 64Q141 3 157 11L154 46L183 33L158 80"
              fill="#fff3cd"
              stroke="#492752"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M56 72Q111 26 159 74L197 50L187 83L199 107L158 91Q103 132 56 72Z"
              fill="#fa967f"
              stroke="#492752"
              strokeWidth="3"
            />
            <ellipse
              cx="85"
              cy="73"
              rx="13"
              ry="17"
              fill="#fff9de"
              stroke="#492752"
              strokeWidth="2"
            />
            <ellipse cx="81" cy="76" rx="5" ry="8" fill="#492752" />
            <path
              d="M59 83L47 85M112 72L121 86L111 96M136 64L143 80L135 99"
              fill="none"
              stroke="#492752"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className="postal-fish-aside">
            {delivery.stamped ? "Necesito vacaciones." : "No le han dicho"}
            <br />
            {delivery.stamped ? "Y una pecera con spa." : "que pesa demasiado."}
          </span>
          <svg
            aria-hidden="true"
            className="postal-clock"
            viewBox="0 0 100 115"
          >
            <path
              d="M8 45C0 0 92 -7 91 44L81 100Q63 124 52 95L48 74Q7 102 8 45Z"
              fill="#ffe582"
              stroke="#492752"
              strokeWidth="3"
            />
            <circle
              cx="49"
              cy="43"
              r="30"
              fill="#fff8e8"
              stroke="#492752"
              strokeWidth="2"
            />
            <path
              d="M49 17V22M49 64V69M23 43H28M70 43H75"
              stroke="#492752"
              strokeWidth="3"
            />
            <path
              className="postal-clock-hand"
              d="M49 24V43L65 49"
              fill="none"
              stroke="#a92059"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <div className="postal-peeker">
            <svg aria-hidden="true" viewBox="0 0 100 100">
              <path
                d="M24 76L10 98M75 76L91 98"
                stroke="#492752"
                strokeWidth="7"
              />
              <path
                d="M5 4H95V82H5Z"
                fill="#e5bb68"
                stroke="#492752"
                strokeWidth="4"
              />
              <image
                href="/images/thekiss.jpg"
                x="11"
                y="10"
                width="78"
                height="66"
                preserveAspectRatio="xMidYMid slice"
              />
              <path
                d="M0 47Q11 35 22 47Q11 60 0 47M78 47Q89 35 100 47Q89 60 78 47"
                fill="#fff3cd"
                stroke="#492752"
                strokeWidth="2"
              />
              <path d="M12 41V53M88 41V53" stroke="#492752" strokeWidth="5" />
            </svg>
          </div>
        </div>
        <div className="postal-envelope">
          <div className="postal-envelope-front" aria-hidden="true">
            <span>
              Para Landa.
              <br />
              <em>Exceso de cariño. No doblar al pez.</em>
            </span>
            <b>♥</b>
          </div>
          <div className="postal-flap" aria-hidden="true" />
          <div className="postal-address">
            <span>
              Para: Landa
              <br />
              <b>Franqueo pagado con cariño</b>
            </span>
            <span className="postal-stamp">
              {delivery.stamped ? "ENTREGADA" : "EN CLASIFICACIÓN"}
            </span>
          </div>
          <div
            className="postal-paper"
            inert={!delivery.opened}
            aria-hidden={!delivery.opened}
          >
            {children}
          </div>
        </div>
      </div>
      <LunarDepartment randomCue={randomCue} />
      <div className="postal-desk">
        <svg
          className="postal-cup"
          data-laboratory-character="walking-teacup"
          viewBox="40 20 280 285"
          aria-hidden="true"
        >
          <path
            d="M139 180L119 229L142 267M207 181L222 230L198 265"
            fill="none"
            stroke="#492752"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M120 222L133 251M220 222L204 251"
            stroke="#ffe7a0"
            strokeWidth="14"
          />
          <path
            d="M139 255Q158 259 164 275Q144 289 111 276Q108 263 139 255ZM197 254Q216 260 231 272Q219 286 181 276Q177 263 197 254Z"
            fill="#e95c7e"
            stroke="#492752"
            strokeWidth="3"
          />
          <path
            d="M241 99C307 58 309 166 249 156L249 138C282 151 286 95 247 118ZM83 90L99 157Q108 203 174 200Q235 201 245 155L261 90Z"
            fill="#fff3cd"
            stroke="#492752"
            strokeWidth="4"
          />
          <path
            d="M103 145Q168 175 242 143L236 164Q178 192 111 163Z"
            fill="#a2cbd0"
          />
          <ellipse
            cx="172"
            cy="90"
            rx="89"
            ry="22"
            fill="#f5b6ad"
            stroke="#492752"
            strokeWidth="4"
          />
          <ellipse cx="172" cy="91" rx="72" ry="12" fill="#9c5964" />
          <path
            d="M142 125Q148 114 153 127M193 127Q200 115 205 127M166 137Q174 152 185 138M89 114Q52 125 53 159L72 149M242 167Q275 188 279 165M158 72Q134 48 158 31M187 68Q208 45 187 29"
            fill="none"
            stroke="#492752"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <ellipse cx="132" cy="136" rx="12" ry="6" fill="#ed8aa2" />
          <ellipse cx="212" cy="138" rx="12" ry="6" fill="#ed8aa2" />
          <g className="postal-cup-seal" key={delivery.identity}>
            <path
              d="M274 169L308 145L318 161L285 183Z"
              fill="#a92059"
              stroke="#492752"
              strokeWidth="3"
            />
            <path
              d="M284 183L278 200L299 211L311 195Z"
              fill="#ffe582"
              stroke="#492752"
              strokeWidth="3"
            />
          </g>
        </svg>
        <p>
          <b>La señorita Té da el visto bueno.</b>
          <span>
            {delivered
              ? "«Demasiado cariño. Habrá que entregarlo igual.»"
              : "«Sin carta no sello. Tengo mis principios.»"}
          </span>
        </p>
        <span className="postal-route" aria-hidden="true">
          {direction === -1
            ? "← Del cajón de los recuerdos"
            : direction === 1
              ? "Del mañana, con permiso →"
              : "Servicio urgente de quererte"}
        </span>
      </div>
      <button
        type="button"
        className="postal-skip"
        onClick={delivery.toggle}
        aria-disabled={!delivered}
      >
        {!delivered
          ? "En espera de carta"
          : delivery.running
            ? "Saltar animación"
            : "Repetir entrega"}
      </button>
    </section>
  );
}
