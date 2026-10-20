/** Decorative local painting collage; all readable content lives outside it. */
export default function SurpriseWorld() {
  return (
    <div className="surprise-world" aria-hidden="true">
      <div className="surprise-orbit" />
      <div className="surprise-moon" />
      <div className="surprise-painting">
        <div />
      </div>
      <div className="surprise-window" />
      <div className="surprise-stair">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="surprise-cloud surprise-cloud-one" />
      <div className="surprise-cloud surprise-cloud-two" />
      <div className="surprise-drop" />
    </div>
  );
}
