// Bibby Brickwork Limited: Construction Dust and Respiratory Protection Risk Alert.
// One page, three key questions, then the sign-off. The text, the questions and the answer key all live here.
// A change to any of it is a new revision.
// Block types: p (paragraph), h (section heading), list, key (key message), warn (stop message), eg (site example), fig (illustration), banner, rules, statement.

const DECLARATION = 'I confirm that I have read the Bibby Brickwork Limited Construction Dust and Respiratory Protection Risk Alert, understood the requirements explained, and agree to follow the company\'s dust-control procedures, RAMS, COSHH assessments and respiratory protection requirements. I understand that work must stop where suitable controls are not in place.';

const modules = [
  {
    n: 1, title: 'Construction Dust and Respiratory Protection', mins: 5,
    blocks: [
      { t: 'h', x: '1. Why you are getting this alert' },
      { t: 'p', x: 'On 29 October 2026 the Health and Safety Executive (HSE) inspected our work at Stone Lodge, Silsden. Following that inspection the HSE wrote to Bibby Brickwork Limited about the way construction dust and respiratory protection were being managed. Every bricklayer, labourer and supervisor working for Bibby Brickwork must read this alert, answer the three questions and sign it.' },

      { t: 'h', x: '2. The risk' },
      { t: 'list', items: [
        'Brick, block, concrete, mortar and stone all contain silica. Cutting, grinding, chasing and drilling them makes a very fine dust called respirable crystalline silica (RCS).',
        'The dangerous dust is too fine to see. It stays in the air after the visible cloud has gone and is breathed in by everyone nearby.',
        'It causes silicosis, lung cancer and chronic obstructive pulmonary disease (COPD). The damage is permanent and cannot be cured.',
      ] },

      { t: 'h', x: '3. Control the dust at the tool' },
      { t: 'p', x: 'A mask is the last line of protection, not the first. Limit cutting where you can, then control the dust where it is made.' },
      { t: 'fig', id: 'saw', cap: 'Left: dry cutting, not permitted. Right: water suppression on the blade, with suitable RPE worn.' },
      { t: 'list', items: [
        'Cut-off saws: water suppression on the blade for the whole of every cut, and RPE with an assigned protection factor (APF) of 20. Both together. Water does not replace the mask, and the mask does not replace the water.',
        'Grinding, chasing and raking out mortar: on-tool extraction connected to an M-class or H-class unit, and APF 20 RPE.',
        'Drilling: on-tool extraction or a dust collector on the drill.',
        'Clearing up: damp down or use an M-class vacuum. Do not dry sweep.',
        'The RAMS and COSHH assessment tell you which controls are needed for the task. If you do not know, ask before you start.',
      ] },
      { t: 'warn', x: 'If the water or extraction is missing, broken or stops working, stop work straight away. Tell your supervisor and do not restart until it is put right.' },

      { t: 'h', x: '4. Masks, face-fit testing and being clean-shaven' },
      { t: 'p', x: 'FFP3 disposable masks and half-masks with P3 filters are tight-fitting. They only work if they seal against your skin all the way round.' },
      { t: 'fig', id: 'seal', cap: 'Left: clean-shaven, the mask seals to the skin. Right: stubble holds the seal off the face and dust leaks in.' },
      { t: 'list', items: [
        'Face-fit test: you must have passed a face-fit test for the mask you wear. A fit test covers only the make, model and size that was tested. A different mask needs its own fit test.',
        'Clean-shaven: you must be clean-shaven wherever the mask touches your face, shaved on the day before the shift. Even short stubble breaks the seal.',
        'Beards: if you have a beard or cannot be clean-shaven, a tight-fitting mask is not suitable. Tell your supervisor in advance. The company will arrange an approved alternative, normally a loose-fitting powered-air respirator with a hood.',
        'Seal check: check the seal yourself every time you put the mask on. A seal check does not replace a fit test.',
        'Look after it: inspect your mask before use, keep it clean, store it in a sealed bag or box, and do not share it.',
      ] },
      { t: 'warn', x: 'You must not do work that requires tight-fitting RPE unless your face-fit test for that mask has been confirmed and you are clean-shaven in the seal area.' },

      { t: 'h', x: '5. Bibby Brickwork site rules' },
      { t: 'banner', x: 'NO DUST WITHOUT CONTROLS. NO EXCEPTIONS.' },
      { t: 'rules', items: [
        'Assess the task before starting.',
        'Do not undertake uncontrolled dry cutting, grinding or chasing.',
        'Use the specified water suppression or dust extraction equipment.',
        'Wear the correct RPE wherever the assessment requires it.',
        'Do not use tight-fitting RPE without the appropriate face-fit test.',
        'Be clean-shaven in the face-seal area when using tight-fitting RPE.',
        'Where facial hair prevents a seal, use an approved suitable alternative.',
        'Inspect RPE and dust-control equipment before use.',
        'Stop work immediately if the controls are missing, defective or ineffective.',
        'Report concerns to the supervisor before restarting.',
      ] },

      { t: 'h', x: '6. Monitoring and zero tolerance' },
      { t: 'statement', h: 'Company statement', paras: [
        'Following the HSE inspection, Bibby Brickwork Limited is strengthening its supervision and monitoring arrangements across all projects.',
        'There will be zero tolerance of uncontrolled dust-generating activities or deliberate failure to follow the company\'s respiratory protection requirements.',
        'Supervisors will carry out recorded checks of:',
      ], items: [
        'Dust suppression and extraction equipment.',
        'Correct selection and use of RPE.',
        'Clean-shaven compliance where tight-fitting masks are used.',
        'Face-fit testing records.',
        'Operative training and understanding.',
        'Equipment condition and maintenance.',
        'Compliance with RAMS and COSHH assessments.',
      ], after: [
        'Unsafe activities will be stopped immediately, and work will only restart once suitable controls are confirmed.',
        'Non-compliance will be addressed through instruction, retraining and, where appropriate, the company\'s disciplinary procedures.',
      ] },
    ],
  },
];

// ---------- The three key questions ----------
// All three are presented every time and all three must be answered correctly.
// a = index of the correct option. why = explanation. wrong[i] = why option i is incorrect.
const bank = [
  { id: 'K1', critical: true, module: 1, kind: 'scenario',
    q: 'The water supply to your cut-off saw fails halfway through cutting concrete blocks. What must you do?',
    options: [
      'Finish the block you are on, then sort the water out.',
      'Stop cutting immediately. Do not restart until the water is working again, and report it to your supervisor if it cannot be fixed.',
      'Carry on cutting dry, because you are wearing a P3 respirator.',
      'Pour water over the remaining blocks from a bucket and carry on.',
    ], a: 1,
    why: 'Water must flow for the whole of every cut. If it stops, the cutting stops straight away and does not restart until the control is working again.',
    wrong: { 0: 'Finishing even one cut dry puts a large amount of silica dust into the air in seconds. The work stops as soon as the control fails.', 2: 'RPE is used with water suppression, not instead of it. A respirator does not make dry cutting acceptable, and it does nothing for the people around you.', 3: 'Wetting the block beforehand does not control the dust. The water has to be fed onto the blade throughout the cut.' } },
  { id: 'K2', critical: true, module: 1, kind: 'scenario',
    q: 'You arrive on site with a week\'s stubble and have been issued a half-mask. You are due to cut blocks. What must you do?',
    options: [
      'Tell your supervisor before starting. You must not do the cutting in that mask until you are clean-shaven, or you have been given an approved suitable alternative.',
      'Pull the straps tighter than usual so the mask seals over the stubble.',
      'Carry on, because the water suppression on the saw will deal with the dust.',
      'Wear an FFP3 disposable mask instead, because disposables are not affected by stubble.',
    ], a: 0,
    why: 'A tight-fitting mask must seal against clean-shaven skin. With stubble in the seal area you must not do work that needs it. Tell your supervisor, who will arrange other work or an approved alternative such as a powered-air respirator.',
    wrong: { 1: 'Tightening the straps does not close the gaps that stubble makes at the seal. The mask still leaks.', 2: 'Water suppression reduces the dust but does not remove it. Cut-off saw work needs water and effective RPE together.', 3: 'An FFP3 disposable is also a tight-fitting mask. Stubble breaks its seal in exactly the same way.' } },
  { id: 'K3', critical: true, module: 1, kind: 'scenario',
    q: 'You have been face-fit tested for one respirator but are issued a different model. Can you use it for work that requires a tight-fitting mask?',
    options: [
      'Yes, if it is the same type of mask, for example another half-mask.',
      'Yes, as long as it feels comfortable and passes a seal check.',
      'No. A fit test only covers the make, model and size that was tested. You need a fit test for the new mask first.',
      'Yes, if a colleague has passed a fit test on that model.',
    ], a: 2,
    why: 'A face-fit test applies to one wearer and one specific make, model and size of mask. A different mask needs its own fit test before you rely on it.',
    wrong: { 0: 'Masks of the same type from different makers, or in different models, are different shapes. A pass on one tells you nothing about another.', 1: 'A seal check shows you have put a mask on properly. Only a fit test shows that the mask is the right shape and size for your face.', 3: 'Fit tests are personal. Another person\'s result does not apply to your face.' } },
];

module.exports = {
  code: 'BB-RA-01',
  title: 'Construction Dust and Respiratory Protection Risk Alert',
  revision: 1,
  revision_date: '2026-11-13',
  author: 'Safety Simplified Ltd',
  pass_mark: 100,
  questions_per_attempt: bank.length,
  attempts_before_lock: 2,
  declaration: DECLARATION,
  background: {
    notice_ref: 'CH14002192',
    notice_date: '2026-11-09',
    inspection_date: '2026-10-29',
    inspection_site: 'Stone Lodge, Silsden',
  },
  objectives: [
    'That brick, block, concrete, mortar and stone dust contains respirable crystalline silica (RCS), that the harmful dust cannot easily be seen, and that it causes silicosis, lung cancer and chronic obstructive pulmonary disease.',
    'That dust is controlled at the tool first, with water suppression or on-tool extraction, and that RPE is used with those controls and not instead of them.',
    'That tight-fitting RPE requires a face-fit test for the specific make, model and size, a clean-shaven seal area and a seal check every time it is fitted, and that a suitable alternative is used where facial hair prevents a seal.',
    'The company\'s mandatory site rules, including stopping work where the controls are missing, defective or ineffective.',
    'The company\'s strengthened monitoring arrangements and zero-tolerance approach to unsafe dust-generating work.',
  ],
  references: [
    'HSE Construction Information Sheet CIS36 (Revision 3): Construction dust',
    'HSE COSHH Essentials in construction: Silica, sheet CN6: Cutting blocks, paving and kerbstones with a cut-off saw',
    'HSE HSG53: Respiratory protective equipment at work',
    'HSE INDG479: Guidance on respiratory protective equipment (RPE) fit testing',
    'Control of Substances Hazardous to Health Regulations 2002 (COSHH)',
    'Construction (Design and Management) Regulations 2015 (CDM)',
  ],
  modules,
  minutes: 5,
  bank,
};
