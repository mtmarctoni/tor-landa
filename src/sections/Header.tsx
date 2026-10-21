import type React from "react";

const Header: React.FC = () => (
  <header className="journal-header laboratory-header">
    <div className="journal-masthead">
      <div>
        <p className="journal-eyebrow">Un lugar donde lo imposible flota</p>
        <h1 aria-label="Cualidades de Landa">
          <span>Cualidades de</span>{" "}
          <em>
            {Array.from("Landa").map((letter, i) => (
              <span key={`${letter}-${i}`}>{letter}</span>
            ))}
          </em>
        </h1>
      </div>
      <span className="journal-header-rule" aria-hidden="true" />
    </div>
  </header>
);

export default Header;
