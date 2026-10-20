import type React from "react";

const Header: React.FC = () => (
  <header className="journal-header">
    <div className="journal-masthead">
      <div>
        <p className="journal-eyebrow">Un lugar donde lo imposible flota</p>
        <h1>
          Cualidades de <em>Landa</em>
        </h1>
      </div>
      <span className="journal-header-rule" aria-hidden="true" />
    </div>
  </header>
);

export default Header;
