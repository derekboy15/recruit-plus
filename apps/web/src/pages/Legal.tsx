import { DISCLAIMER } from '../layout/Footer';

export function Legal() {
  return (
    <section>
      <h1>Legal &amp; credits</h1>
      <div className="card">
        <p>{DISCLAIMER}</p>
        <p>
          This site is a free, non-commercial fan project. Rules are summarised in plain English by default; official
          wording is shown only where you choose to view it.
        </p>
      </div>
      <h2>Data sources</h2>
      <ul>
        <li>
          Army data: the BSData <code>wh40k-9e</code> community project, final 9th Edition release (v9.8.0).
        </li>
        <li>Datasheet details, points and rules text: partly powered by Wahapedia (9th Edition export, June 2023).</li>
        <li>
          Plain-English rules text is written by Recruit+ in its own words; the official wording comes from BattleScribe
          data and Wahapedia.
        </li>
      </ul>
    </section>
  );
}
