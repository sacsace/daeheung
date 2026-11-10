import type { PersonalRecordSection } from './EmployeePersonalRecordContent';
import { formatPositionLabel } from '../../utils/positionLabels';
import {
  type I18nTranslate,
  formatBankAccountDisplay,
  formatIfscDisplay,
  formatPhoneDisplay,
  getEmploymentTypeLabel,
  getGenderLabel,
  getRoleLabel,
  getStatusLabel,
  hasDetailValue,
} from '../../utils/personalInfoFormat';

type CareerEntry = {
  company_name: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
};

type EducationEntry = {
  school_name: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
};

type CertificateEntry = {
  name: string;
  issuer: string;
  certificate_number: string;
  issue_date: string;
  expiry_date: string;
};

function normalizeCareerForm(raw: unknown): CareerEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    company_name: String(row?.company_name ?? '').trim(),
    position: String(row?.position ?? '').trim(),
    start_date: String(row?.start_date ?? '').trim(),
    end_date: String(row?.end_date ?? '').trim(),
    description: String(row?.description ?? '').trim(),
  }));
}

function normalizeEducationForm(raw: unknown): EducationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    school_name: String(row?.school_name ?? '').trim(),
    degree: String(row?.degree ?? '').trim(),
    major: String(row?.major ?? '').trim(),
    start_date: String(row?.start_date ?? '').trim(),
    end_date: String(row?.end_date ?? '').trim(),
  }));
}

function normalizeCertificateForm(raw: unknown): CertificateEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    name: String(row?.name ?? '').trim(),
    issuer: String(row?.issuer ?? '').trim(),
    certificate_number: String(row?.certificate_number ?? '').trim(),
    issue_date: String(row?.issue_date ?? '').trim(),
    expiry_date: String(row?.expiry_date ?? '').trim(),
  }));
}

export function buildEmployeePersonalRecordSections(params: {
  user: Record<string, any>;
  t: I18nTranslate;
  dateLocale: string;
  language: string;
  salaryDisplay?: string;
}): PersonalRecordSection[] {
  const { user, t, dateLocale, language, salaryDisplay } = params;
  const su = user;

  const genderLabel = getGenderLabel(t, su.gender);
  const phoneDisplay = formatPhoneDisplay(su.phone || '');
  const emergencyPhoneDisplay = formatPhoneDisplay(su.emergency_phone || '');
  const hireDateDisplay = su.hire_date
    ? new Date(su.hire_date).toLocaleDateString(dateLocale)
    : '';
  const birthDateDisplay = su.birth_date
    ? new Date(su.birth_date).toLocaleDateString(dateLocale)
    : '';
  const employmentLabel = getEmploymentTypeLabel(t, su.employment_type);
  const positionLabel = formatPositionLabel(user.position, language);
  const hasSalary = Boolean(user.has_salary) || (su.salary != null && su.salary !== '');
  const careers = normalizeCareerForm(su.career_history).filter((c) => c.company_name);
  const educations = normalizeEducationForm(su.education_history).filter((e) => e.school_name);
  const certificates = normalizeCertificateForm(su.certificate_history).filter((c) => c.name);

  const pushField = (fields: { label: string; value: string }[], label: string, value: unknown) => {
    if (!hasDetailValue(value)) return;
    fields.push({ label, value: String(value).trim() });
  };

  const sections: PersonalRecordSection[] = [];

  const basicFields: { label: string; value: string }[] = [];
  pushField(
    basicFields,
    t('userManagement.employeeNumber'),
    su.employee_number ? String(su.employee_number).toUpperCase() : su.employee_number
  );
  pushField(basicFields, t('userManagement.name'), user.username);
  pushField(basicFields, t('userManagement.dateOfBirth'), birthDateDisplay);
  pushField(basicFields, t('userManagement.gender'), genderLabel);
  pushField(basicFields, t('userManagement.phoneNumber'), phoneDisplay);
  pushField(basicFields, t('userManagement.email'), user.email);
  if (su.is_payment_officer) {
    basicFields.push({
      label: t('userManagement.paymentOfficer'),
      value: t('userManagement.paymentOfficerAssigned'),
    });
  }
  pushField(basicFields, t('userManagement.address'), su.address);
  pushField(basicFields, t('userManagement.emergencyContactName'), su.emergency_contact);
  pushField(basicFields, t('userManagement.emergencyContactPhone'), emergencyPhoneDisplay);
  if (basicFields.length) {
    sections.push({ title: t('userManagement.sectionBasic'), fields: basicFields });
  }

  const hrFields: { label: string; value: string }[] = [];
  pushField(hrFields, t('userManagement.hireDate'), hireDateDisplay);
  pushField(hrFields, t('userManagement.employmentType'), employmentLabel);
  pushField(hrFields, t('userManagement.department'), user.department);
  pushField(hrFields, t('userManagement.positionTitle'), positionLabel);
  if (hasSalary) {
    hrFields.push({
      label: t('userManagement.salary'),
      value: salaryDisplay || t('userManagement.salaryMasked'),
    });
  }
  hrFields.push({
    label: t('userManagement.otEligible'),
    value:
      su.ot_eligible === true
        ? t('userManagement.otEligibleYes')
        : t('userManagement.otEligibleNo'),
  });
  hrFields.push({
    label: t('userManagement.ptEligible'),
    value:
      su.pt_eligible === false
        ? t('userManagement.ptEligibleNo')
        : t('userManagement.ptEligibleYes'),
  });
  {
    const m = String(su.pf_calc_mode ?? '').trim();
    const pfLabel =
      m === 'none'
        ? t('userManagement.pfCapNone')
        : m === 'total_12pct'
        ? t('userManagement.pfCapTotal12pct')
        : m === 'basic_12pct' || su.pf_cap_1800 === false
          ? t('userManagement.pfCap12pct')
          : t('userManagement.pfCap1800');
    hrFields.push({ label: t('userManagement.pfCap'), value: pfLabel });
  }
  if (hrFields.length) {
    sections.push({ title: t('userManagement.sectionHr'), fields: hrFields });
  }

  if (careers.length) {
    sections.push({
      title: t('userManagement.sectionCareer'),
      items: careers.map((c) => ({
        title: `${c.company_name}${c.position ? ` · ${c.position}` : ''}`,
        subtitle:
          c.start_date || c.end_date
            ? `${c.start_date ? new Date(c.start_date).toLocaleDateString(dateLocale) : '—'} ~ ${
                c.end_date
                  ? new Date(c.end_date).toLocaleDateString(dateLocale)
                  : t('userManagement.careerPresent')
              }`
            : undefined,
        body: c.description || undefined,
      })),
    });
  }

  if (educations.length) {
    sections.push({
      title: t('userManagement.sectionEducation'),
      items: educations.map((e) => ({
        title: `${e.school_name}${e.major ? ` · ${e.major}` : ''}`,
        subtitle:
          e.start_date || e.end_date
            ? `${e.start_date ? new Date(e.start_date).toLocaleDateString(dateLocale) : '—'} ~ ${
                e.end_date ? new Date(e.end_date).toLocaleDateString(dateLocale) : '—'
              }`
            : undefined,
        body: e.degree || undefined,
      })),
    });
  }

  if (certificates.length) {
    sections.push({
      title: t('userManagement.sectionCertificate'),
      items: certificates.map((c) => ({
        title: `${c.name}${c.issuer ? ` · ${c.issuer}` : ''}`,
        subtitle:
          [
            c.certificate_number || '',
            c.issue_date || c.expiry_date
              ? `${c.issue_date ? new Date(c.issue_date).toLocaleDateString(dateLocale) : '—'}${
                  c.expiry_date
                    ? ` ~ ${new Date(c.expiry_date).toLocaleDateString(dateLocale)}`
                    : ''
                }`
              : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      })),
    });
  }

  const bankFields: { label: string; value: string }[] = [];
  pushField(bankFields, t('userManagement.bankName'), su.bank_name);
  pushField(
    bankFields,
    t('userManagement.accountNumber'),
    su.bank_account ? formatBankAccountDisplay(String(su.bank_account)) : ''
  );
  pushField(
    bankFields,
    t('userManagement.ifscCode'),
    su.bank_ifsc ? formatIfscDisplay(String(su.bank_ifsc)) : ''
  );
  if (bankFields.length) {
    sections.push({ title: t('userManagement.sectionBank'), fields: bankFields });
  }

  const accountFields: { label: string; value: string }[] = [];
  pushField(accountFields, t('userManagement.userId'), user.userid);
  pushField(accountFields, t('userManagement.role'), getRoleLabel(t, user.role));
  pushField(accountFields, t('userManagement.statusLabel'), getStatusLabel(t, user.status));
  pushField(
    accountFields,
    t('userManagement.createdAt'),
    user.created_at ? new Date(user.created_at).toLocaleDateString(dateLocale) : ''
  );
  if (accountFields.length) {
    sections.push({ title: t('userManagement.sectionAccount'), fields: accountFields });
  }

  return sections;
}

export type { I18nTranslate };
