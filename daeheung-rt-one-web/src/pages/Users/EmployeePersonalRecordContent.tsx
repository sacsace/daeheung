import React from 'react';
import { Box, Typography } from '@mui/material';

export type PersonalRecordField = {
  label: string;
  value: string;
};

export type PersonalRecordListItem = {
  title: string;
  subtitle?: string;
  body?: string;
};

export type PersonalRecordSection = {
  title: string;
  fields?: PersonalRecordField[];
  items?: PersonalRecordListItem[];
};

export type EmployeePersonalRecordProps = {
  documentTitle: string;
  companyName: string;
  companyLogoUrl?: string | null;
  companyContact?: string;
  photoUrl?: string | null;
  photoAlt?: string;
  employeeName: string;
  generatedAtLabel: string;
  generatedAt: string;
  sections: PersonalRecordSection[];
};

const PT9 = '9pt';
const PT12 = '12pt';
const LINE_18 = '18pt';

const BORDER = '#757575';
const GRID = '#BDBDBD';
const LABEL_BG = '#F5F5F5';
const SECTION_BG = '#E8E8E8';
const HEADER_BG = '#F0F0F0';
const TEXT = '#212121';
const MUTED = '#616161';

function chunkPairs<T>(arr: T[], size = 2): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const EmployeePersonalRecordContent = React.forwardRef<HTMLDivElement, EmployeePersonalRecordProps>(
  function EmployeePersonalRecordContent(
    {
      documentTitle,
      companyName,
      companyLogoUrl,
      companyContact,
      photoUrl,
      photoAlt,
      employeeName,
      generatedAtLabel,
      generatedAt,
      sections,
    },
    ref
  ) {
    const initial = String(employeeName || '?').trim().charAt(0).toUpperCase() || '?';

    return (
      <Box
        ref={ref}
        sx={{
          bgcolor: '#FFFFFF',
          color: TEXT,
          width: '100%',
          boxSizing: 'border-box',
          p: 1.5,
          fontFamily: '"Noto Sans KR", "Segoe UI", Arial, sans-serif',
          fontSize: PT9,
          lineHeight: LINE_18,
        }}
      >
        <Box
          sx={{
            border: `1px solid ${BORDER}`,
            overflow: 'hidden',
          }}
        >
          {/* 문서 헤더 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              borderBottom: `1px solid ${BORDER}`,
              bgcolor: HEADER_BG,
            }}
          >
            <Box
              sx={{
                flex: 1,
                px: 1.25,
                py: 0.85,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                gap: 0.5,
                minWidth: 0,
              }}
            >
              {companyLogoUrl ? (
                <Box
                  component="img"
                  src={companyLogoUrl}
                  alt={companyName}
                  sx={{
                    maxHeight: 40,
                    maxWidth: 140,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : null}
              <Box sx={{ minWidth: 0, width: '100%' }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: PT9,
                    lineHeight: LINE_18,
                    color: TEXT,
                  }}
                >
                  {companyName || '—'}
                </Typography>
                {companyContact ? (
                  <Typography sx={{ fontSize: PT9, color: MUTED, lineHeight: LINE_18, mt: 0.2 }}>
                    {companyContact}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Box
              sx={{
                width: 96,
                borderLeft: `1px solid ${BORDER}`,
                bgcolor: '#FFF',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  px: 0.5,
                  py: 0.25,
                  borderBottom: `1px solid ${GRID}`,
                  bgcolor: LABEL_BG,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: PT9, fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>
                  PHOTO
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0.5,
                  minHeight: 110,
                }}
              >
                {photoUrl ? (
                  <Box
                    component="img"
                    src={photoUrl}
                    alt={photoAlt || employeeName}
                    sx={{
                      width: '100%',
                      height: 108,
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      border: `1px solid ${GRID}`,
                      display: 'block',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 108,
                      border: `1px dashed ${GRID}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#FAFAFA',
                      fontSize: PT12,
                      fontWeight: 700,
                      color: '#9E9E9E',
                    }}
                  >
                    {initial}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderBottom: `1px solid ${BORDER}`,
              bgcolor: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: PT12,
                letterSpacing: '0.06em',
                lineHeight: LINE_18,
                color: TEXT,
              }}
            >
              {documentTitle}
            </Typography>
          </Box>

          {sections.map((section) => {
            const fields = (section.fields || []).filter((f) => String(f.value || '').trim());
            const items = (section.items || []).filter((it) => String(it.title || '').trim());
            if (!fields.length && !items.length) return null;

            return (
              <Box key={section.title} data-pdf-break="">
                <Box
                  data-pdf-break=""
                  sx={{
                    px: 1,
                    py: 0.4,
                    bgcolor: SECTION_BG,
                    borderTop: `1px solid ${BORDER}`,
                    borderBottom: `1px solid ${GRID}`,
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: PT9, color: TEXT }}>
                    {section.title}
                  </Typography>
                </Box>

                {fields.length > 0 ? (
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <Box component="tbody">
                      {chunkPairs(fields, 2).map((pair, rowIdx) => (
                        <Box component="tr" key={`${section.title}-r${rowIdx}`} data-pdf-break="">
                          {pair.map((field) => (
                            <React.Fragment key={`${section.title}-${field.label}`}>
                              <Box
                                component="td"
                                sx={{
                                  width: '16%',
                                  border: `1px solid ${GRID}`,
                                  bgcolor: LABEL_BG,
                                  px: 0.75,
                                  py: 0.45,
                                  verticalAlign: 'middle',
                                  fontSize: PT9,
                                  fontWeight: 700,
                                  color: MUTED,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {field.label}
                              </Box>
                              <Box
                                component="td"
                                sx={{
                                  width: '34%',
                                  border: `1px solid ${GRID}`,
                                  px: 0.75,
                                  py: 0.45,
                                  verticalAlign: 'middle',
                                  fontSize: PT9,
                                  fontWeight: 400,
                                  color: TEXT,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {field.value}
                              </Box>
                            </React.Fragment>
                          ))}
                          {pair.length === 1 ? (
                            <>
                              <Box
                                component="td"
                                sx={{
                                  width: '16%',
                                  border: `1px solid ${GRID}`,
                                  bgcolor: LABEL_BG,
                                }}
                              />
                              <Box
                                component="td"
                                sx={{
                                  width: '34%',
                                  border: `1px solid ${GRID}`,
                                }}
                              />
                            </>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null}

                {items.length > 0 ? (
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <Box component="tbody">
                      {items.map((item, idx) => (
                        <Box component="tr" key={`${section.title}-i${idx}`} data-pdf-break="">
                          <Box
                            component="td"
                            sx={{
                              width: '7%',
                              border: `1px solid ${GRID}`,
                              bgcolor: LABEL_BG,
                              px: 0.5,
                              py: 0.45,
                              textAlign: 'center',
                              fontSize: PT9,
                              fontWeight: 700,
                              color: MUTED,
                              verticalAlign: 'top',
                            }}
                          >
                            {idx + 1}
                          </Box>
                          <Box
                            component="td"
                            sx={{
                              border: `1px solid ${GRID}`,
                              px: 0.75,
                              py: 0.45,
                              verticalAlign: 'top',
                            }}
                          >
                            <Typography sx={{ fontSize: PT9, fontWeight: 700, lineHeight: LINE_18, color: TEXT }}>
                              {item.title}
                            </Typography>
                            {item.subtitle ? (
                              <Typography sx={{ fontSize: PT9, color: MUTED, mt: 0.15, lineHeight: LINE_18 }}>
                                {item.subtitle}
                              </Typography>
                            ) : null}
                            {item.body ? (
                              <Typography sx={{ fontSize: PT9, color: TEXT, mt: 0.25, lineHeight: LINE_18 }}>
                                {item.body}
                              </Typography>
                            ) : null}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            );
          })}

          <Box
            data-pdf-break=""
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 1,
              py: 0.55,
              borderTop: `1px solid ${BORDER}`,
              bgcolor: LABEL_BG,
            }}
          >
            <Typography sx={{ fontSize: PT9, color: MUTED }}>
              {generatedAtLabel}: {generatedAt}
            </Typography>
            <Typography sx={{ fontSize: PT9, color: MUTED }}>{employeeName}</Typography>
          </Box>
        </Box>
      </Box>
    );
  }
);

export default EmployeePersonalRecordContent;
