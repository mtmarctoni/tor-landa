import Image from "next/image";

/** Impossible scenery stays behind the protected photo and controls. */
export default function BirthdayWorld() {
  return (
    <div className="birthday-world" aria-hidden="true">
      <div className="birthday-orbit birthday-orbit-one" />
      <div className="birthday-orbit birthday-orbit-two" />
      <div className="birthday-moon" />
      <div className="birthday-cloud birthday-cloud-one" />
      <div className="birthday-cloud birthday-cloud-two" />
      <div className="birthday-satellite birthday-satellite-one">
        <Image src="/images/dali1.webp" alt="" fill sizes="120px" />
      </div>
      <div className="birthday-satellite birthday-satellite-two">
        <Image src="/images/thekiss.jpg" alt="" fill sizes="100px" />
      </div>
      <div className="birthday-stair" />
    </div>
  );
}
