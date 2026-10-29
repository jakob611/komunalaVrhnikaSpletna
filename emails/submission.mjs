import React from 'react';
import { Html, Head, Body, Container, Section, Heading, Text, Preview, Button } from 'react-email';

const h = React.createElement;
// Rendered once during the build: no React email rendering in a request Worker.
export default function SubmissionEmail() {
  return h(Html, { lang: 'sl' }, h(Head),
    h(Body, { lang: 'sl', style: { margin: 0, backgroundColor: '#f1f5f2', fontFamily: 'Arial, Helvetica, sans-serif' } },
      h(Preview, null, 'Nova oddaja iz predstavitvenega portala KPV.'),
      h(Container, { style: { maxWidth: '600px', padding: '24px 16px' } },
        h(Section, { style: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px' } },
          h(Text, { style: { fontSize: '14px', color: '#176445', fontWeight: 'bold' } }, 'KPV · PREDSTAVITVENI PORTAL'),
          h(Heading, { as: 'h1', style: { fontSize: '24px', color: '#183b2d' } }, 'KPV_TITLE_TOKEN'),
          h(Text, { style: { fontSize: '16px', lineHeight: '26px', color: '#243b30', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, 'KPV_DETAILS_TOKEN'),
          h(Button, { href: 'KPV_ADMIN_LINK_TOKEN', style: { backgroundColor: '#194f3a', color: '#ffffff', padding: '14px 18px', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', textDecoration: 'none' } }, 'Odpri v skrbniški konzoli'),
          h(Text, { style: { fontSize: '13px', lineHeight: '21px', color: '#51635a' } },
            'To je oddaja na preizkusnem portalu. Ne pomeni uradnega naročila, rezervacije ali plačila pri podjetju KPV. Z odgovorom na to e-pošto se obrnete na pošiljatelja obrazca.'),
        ),
      ),
    ),
  );
}
