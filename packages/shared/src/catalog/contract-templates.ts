/**
 * Contract templates.
 *
 * Israeli residential leases are near-boilerplate — most are a lightly edited
 * copy of the same few documents — which is exactly why a template library is
 * worth having and exactly why it must not pretend to be more than it is.
 * Every template carries a `disclaimer` that the UI is required to render: this
 * is a draft to take to a lawyer, not legal advice, and the product says so on
 * the document rather than in a settings page nobody opens.
 *
 * Placeholders are `{{snake_case}}` and every one a template uses must be
 * declared in `variables`, so an unfilled field is a validation error rather
 * than a `{{deposit}}` printed into a signed contract.
 */

export type VariableKind = 'text' | 'money' | 'date' | 'number' | 'boolean';

export interface TemplateVariable {
  key: string;
  label: string;
  kind: VariableKind;
  /** Filled from the lease/property when one is attached */
  from?: 'property.address' | 'property.rooms' | 'lease.rent' | 'lease.deposit'
    | 'lease.start' | 'lease.end' | 'lease.notice' | 'tenant.name' | 'owner.name';
  required: boolean;
  hint?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  /** When this document is the right one */
  useWhen: string;
  variables: TemplateVariable[];
  body: string;
}

const DISCLAIMER =
  'מסמך זה הוא טיוטה לנוחותך בלבד ואינו מהווה ייעוץ משפטי. מומלץ שעורך דין יעבור עליו לפני חתימה.';

export const CONTRACT_DISCLAIMER = DISCLAIMER;

/* Variables shared by every lease-shaped document. */
const PARTIES: TemplateVariable[] = [
  { key: 'owner_name', label: 'שם המשכיר', kind: 'text', from: 'owner.name', required: true },
  { key: 'owner_id', label: 'ת.ז. המשכיר', kind: 'text', required: true },
  { key: 'owner_address', label: 'כתובת המשכיר', kind: 'text', required: false },
  { key: 'tenant_name', label: 'שם השוכר', kind: 'text', from: 'tenant.name', required: true },
  { key: 'tenant_id', label: 'ת.ז. השוכר', kind: 'text', required: true },
];

const PREMISES: TemplateVariable[] = [
  { key: 'property_address', label: 'כתובת הנכס', kind: 'text', from: 'property.address', required: true },
  { key: 'rooms', label: 'מספר חדרים', kind: 'number', from: 'property.rooms', required: true },
];

const TERMS: TemplateVariable[] = [
  { key: 'start_date', label: 'תחילת השכירות', kind: 'date', from: 'lease.start', required: true },
  { key: 'end_date', label: 'סיום השכירות', kind: 'date', from: 'lease.end', required: true },
  { key: 'monthly_rent', label: 'שכר דירה חודשי', kind: 'money', from: 'lease.rent', required: true },
  { key: 'payment_day', label: 'יום התשלום בחודש', kind: 'number', required: true, hint: 'בדרך כלל 1 עד 10' },
  { key: 'deposit', label: 'פיקדון', kind: 'money', from: 'lease.deposit', required: true },
  { key: 'notice_days', label: 'הודעה מוקדמת (ימים)', kind: 'number', from: 'lease.notice', required: true },
];

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'ct-standard',
    name: 'שכירות בלתי מוגנת — סטנדרטי',
    description: 'החוזה הרגיל לדירת מגורים. תקופה קצובה, פיקדון, הודעה מוקדמת.',
    useWhen: 'רוב ההשכרות. דירה שלמה, שוכר אחד או בני זוג, תקופה של שנה או שנתיים.',
    variables: [...PARTIES, ...PREMISES, ...TERMS],
    body: `חוזה שכירות בלתי מוגנת

שנערך ונחתם ביום {{signed_date}}

בין: {{owner_name}}, ת.ז. {{owner_id}} (להלן "המשכיר")
לבין: {{tenant_name}}, ת.ז. {{tenant_id}} (להלן "השוכר")

הואיל והמשכיר הוא בעל הזכויות בנכס; והואיל והשוכר מעוניין לשכור את הנכס למגורים —

1. הנכס
   דירה בת {{rooms}} חדרים ברחוב {{property_address}} (להלן "המושכר").
   המושכר מושכר למטרת מגורים בלבד.

2. תקופת השכירות
   תקופת השכירות תחל ביום {{start_date}} ותסתיים ביום {{end_date}}.
   השכירות אינה מוגנת ואין ולא תהיינה לשוכר זכויות של דייר מוגן.

3. דמי השכירות
   השוכר ישלם דמי שכירות חודשיים בסך {{monthly_rent}}, מדי חודש בחודשו
   ולא יאוחר מהיום ה־{{payment_day}} בכל חודש.

4. תשלומי חובה
   השוכר יישא בארנונה, חשמל, מים, גז ודמי ועד בית לתקופת השכירות.
   המשכיר יישא במיסים החלים על בעל הנכס ובביטוח מבנה.

5. פיקדון
   להבטחת התחייבויות השוכר יפקיד השוכר בידי המשכיר סך {{deposit}}.
   הפיקדון יושב לשוכר תוך 30 יום ממועד פינוי המושכר, בניכוי חובות או נזקים
   שנגרמו בפועל ומעבר לבלאי סביר.

6. תיקונים ואחזקה
   המשכיר יתקן על חשבונו ליקויים במערכות המושכר שאינם נובעים משימוש רשלני,
   תוך זמן סביר ממועד קבלת הודעה. השוכר יודיע למשכיר על כל ליקוי בסמוך לגילויו.
   תיקונים הנובעים משימוש לקוי של השוכר יחולו עליו.

7. הודעה מוקדמת וסיום
   כל צד רשאי להביא חוזה זה לידי סיום בהודעה מוקדמת בכתב של {{notice_days}} ימים.
   בתום התקופה יפנה השוכר את המושכר כשהוא נקי ותקין, למעט בלאי סביר.

8. פרוטוקול מסירה
   הצדדים יערכו פרוטוקול כניסה במועד המסירה ופרוטוקול יציאה במועד הפינוי,
   הכולל קריאות מונים, מספר מפתחות ותיעוד מצב המושכר.

9. איסור העברה
   השוכר לא יעביר את זכויותיו ולא ישכיר את המושכר בשכירות משנה ללא הסכמת
   המשכיר מראש ובכתב.

ולראיה באו הצדדים על החתום:

_______________________          _______________________
המשכיר                            השוכר

${DISCLAIMER}`,
  },

  {
    id: 'ct-roommates',
    name: 'שכירות לשותפים',
    description: 'מספר שוכרים באותה דירה, עם אחריות משותפת ונפרדת.',
    useWhen: 'דירת שותפים. חשוב בעיקר בגלל סעיף האחריות: כל שותף חב על מלוא שכר הדירה.',
    variables: [
      ...PARTIES,
      { key: 'tenant_2_name', label: 'שם שותף נוסף', kind: 'text', required: true },
      { key: 'tenant_2_id', label: 'ת.ז. שותף נוסף', kind: 'text', required: true },
      ...PREMISES,
      ...TERMS,
      { key: 'room_allocation', label: 'חלוקת החדרים', kind: 'text', required: false },
    ],
    body: `חוזה שכירות בלתי מוגנת — שותפים

שנערך ונחתם ביום {{signed_date}}

בין: {{owner_name}}, ת.ז. {{owner_id}} (להלן "המשכיר")
לבין: {{tenant_name}}, ת.ז. {{tenant_id}}
ולבין: {{tenant_2_name}}, ת.ז. {{tenant_2_id}}
(להלן יחד ולחוד "השוכרים")

1. הנכס
   דירה בת {{rooms}} חדרים ברחוב {{property_address}}.
   {{room_allocation}}

2. תקופת השכירות
   מיום {{start_date}} ועד יום {{end_date}}.

3. דמי השכירות ואחריות יחד ולחוד
   דמי השכירות החודשיים הם {{monthly_rent}}, לתשלום עד היום ה־{{payment_day}} בחודש.
   השוכרים חבים יחד ולחוד במלוא דמי השכירות ובמלוא התחייבויות חוזה זה.
   אין בחלוקה פנימית ביניהם כדי לגרוע מחבות כל אחד מהם כלפי המשכיר.

4. החלפת שותף
   שוכר המבקש לעזוב לפני תום התקופה יודיע למשכיר {{notice_days}} ימים מראש
   ויציע מחליף. כניסת מחליף טעונה הסכמת המשכיר מראש ובכתב ותיעשה בתוספת
   לחוזה זה. עד לכניסת מחליף בפועל, השוכר העוזב נותר חב במלוא חיוביו.

5. פיקדון
   סך {{deposit}} יופקד בידי המשכיר. הפיקדון הוא אחד לדירה כולה ויושב
   לשוכרים במשותף בתום השכירות, בניכוי חובות או נזקים בפועל.

6. תשלומי חובה
   השוכרים יישאו בארנונה, חשמל, מים, גז וועד בית.

7. פינוי
   בתום התקופה יפנו השוכרים את המושכר כשהוא נקי ותקין, למעט בלאי סביר.

ולראיה באו הצדדים על החתום:

_______________________  _______________________  _______________________
המשכיר                    שוכר 1                     שוכר 2

${DISCLAIMER}`,
  },

  {
    id: 'ct-extension',
    name: 'נספח הארכה',
    description: 'הארכת חוזה קיים בתנאים חדשים, בלי לכתוב חוזה מחדש.',
    useWhen: 'השוכר נשאר. מסמך קצר שמצביע על החוזה המקורי ומשנה רק את מה שהשתנה.',
    variables: [
      ...PARTIES,
      ...PREMISES,
      { key: 'original_date', label: 'תאריך החוזה המקורי', kind: 'date', required: true },
      { key: 'start_date', label: 'תחילת ההארכה', kind: 'date', from: 'lease.end', required: true },
      { key: 'end_date', label: 'סיום ההארכה', kind: 'date', required: true },
      { key: 'monthly_rent', label: 'שכר דירה חדש', kind: 'money', from: 'lease.rent', required: true },
      { key: 'previous_rent', label: 'שכר דירה קודם', kind: 'money', required: false },
    ],
    body: `נספח הארכה לחוזה שכירות

שנערך ונחתם ביום {{signed_date}}

בין: {{owner_name}}, ת.ז. {{owner_id}} (להלן "המשכיר")
לבין: {{tenant_name}}, ת.ז. {{tenant_id}} (להלן "השוכר")

הואיל והצדדים התקשרו בחוזה שכירות מיום {{original_date}} לגבי הנכס
ברחוב {{property_address}} (להלן "החוזה המקורי");
והואיל והצדדים מעוניינים להאריך את תקופת השכירות —

הוסכם כדלקמן:

1. תקופת ההארכה
   תקופת השכירות מוארכת מיום {{start_date}} ועד יום {{end_date}}.

2. דמי השכירות בתקופת ההארכה
   דמי השכירות החודשיים בתקופת ההארכה יעמדו על {{monthly_rent}}
   (קודם: {{previous_rent}}).

3. יתר התנאים
   כל יתר תנאי החוזה המקורי יעמדו בתוקפם ללא שינוי, לרבות הפיקדון,
   ההודעה המוקדמת ותשלומי החובה.

4. אין בהארכה זו כדי להקנות לשוכר זכויות של דייר מוגן.

ולראיה באו הצדדים על החתום:

_______________________          _______________________
המשכיר                            השוכר

${DISCLAIMER}`,
  },

  {
    id: 'ct-short-term',
    name: 'שכירות קצרת מועד',
    description: 'תקופה של עד שנה, בדרך כלל מרוהטת ובתשלום כולל.',
    useWhen: 'סאבלט, רילוקיישן, או דירה מרוהטת לתקופה קצובה קצרה.',
    variables: [
      ...PARTIES,
      ...PREMISES,
      { key: 'start_date', label: 'תחילת השכירות', kind: 'date', from: 'lease.start', required: true },
      { key: 'end_date', label: 'סיום השכירות', kind: 'date', from: 'lease.end', required: true },
      { key: 'monthly_rent', label: 'תשלום חודשי כולל', kind: 'money', from: 'lease.rent', required: true },
      { key: 'deposit', label: 'פיקדון', kind: 'money', from: 'lease.deposit', required: true },
      { key: 'includes_bills', label: 'המחיר כולל חשבונות', kind: 'boolean', required: true },
      { key: 'inventory_note', label: 'הערה לגבי הריהוט', kind: 'text', required: false },
    ],
    body: `חוזה שכירות קצרת מועד

שנערך ונחתם ביום {{signed_date}}

בין: {{owner_name}}, ת.ז. {{owner_id}} (להלן "המשכיר")
לבין: {{tenant_name}}, ת.ז. {{tenant_id}} (להלן "השוכר")

1. הנכס
   דירה בת {{rooms}} חדרים ברחוב {{property_address}}, מרוהטת.
   {{inventory_note}}
   רשימת התכולה תצורף לפרוטוקול הכניסה ותהווה חלק בלתי נפרד מחוזה זה.

2. תקופת השכירות
   מיום {{start_date}} ועד יום {{end_date}}. תקופה קצובה שאינה ניתנת
   להארכה אלא בהסכמת שני הצדדים מראש ובכתב.

3. התשלום
   {{monthly_rent}} לחודש. כולל חשבונות: {{includes_bills}}.
   התשלום ישולם מראש עבור כל חודש.

4. פיקדון
   סך {{deposit}} יופקד בידי המשכיר ויושב תוך 14 יום מהפינוי, בניכוי
   נזקים בפועל או פריטי תכולה חסרים.

5. שימוש
   המושכר מיועד למגורי השוכר בלבד. אין להשכיר בשכירות משנה ואין לארח
   בתמורה.

6. פינוי
   השוכר יפנה את המושכר בתום התקופה כשהוא נקי, עם מלוא התכולה שנמסרה לו.

ולראיה באו הצדדים על החתום:

_______________________          _______________________
המשכיר                            השוכר

${DISCLAIMER}`,
  },
];

export function builtInTemplate(id: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find((x) => x.id === id);
}

/** Every `{{key}}` a body actually uses. */
export function placeholdersIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

/**
 * Fill a template.
 *
 * Missing required values are returned rather than silently left as
 * `{{deposit}}` — a placeholder printed into a signed contract is the one
 * failure this must not have.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string>,
  variables: TemplateVariable[],
): { text: string; missing: string[] } {
  const required = new Set(variables.filter((v) => v.required).map((v) => v.key));
  const missing: string[] = [];

  const text = body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined || value === '') {
      if (required.has(key)) missing.push(key);
      /* Optional and unfilled disappears rather than leaving a gap where a
         sentence used to be. */
      return required.has(key) ? `{{${key}}}` : '';
    }
    return value;
  });

  return { text, missing };
}
