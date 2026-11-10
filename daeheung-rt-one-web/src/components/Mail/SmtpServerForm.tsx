import React from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsOutlinedLabelProps,
  mvsSearchFieldSx,
} from '../../theme/daeheungLayout';
import {
  applyGmailSmtpPreset,
  MAIL_PASS_MASK,
  MailServerForm,
  syncMailPortSecure,
} from '../../utils/mailServerForm';

type Props = {
  value: MailServerForm;
  onChange: (next: MailServerForm) => void;
  testTo: string;
  onTestToChange: (v: string) => void;
  onSave: () => void;
  onTest: () => void;
  saving?: boolean;
  testing?: boolean;
  disabled?: boolean;
  labels: {
    gmailPreset: string;
    host: string;
    port: string;
    secure: string;
    authUser: string;
    authPass: string;
    authPassHint?: string;
    fromEmail: string;
    fromName: string;
    testTo: string;
    save: string;
    testSend: string;
  };
};

/** 개인/회사 SMTP 입력 폼 (엑셀형 납작 필드) */
const SmtpServerForm: React.FC<Props> = ({
  value,
  onChange,
  testTo,
  onTestToChange,
  onSave,
  onTest,
  saving,
  testing,
  disabled,
  labels,
}) => {
  const [passFocused, setPassFocused] = React.useState(false);
  const [passVisible, setPassVisible] = React.useState(false);
  const showMask = value.authPassConfigured && value.authPass === '' && !passFocused;

  const setField = (key: keyof MailServerForm, raw: string | number | boolean) => {
    onChange(syncMailPortSecure(value, key, raw));
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        disabled={disabled}
        onClick={() => onChange(applyGmailSmtpPreset(value))}
        sx={{ ...mvsBodyOutlinedBtnSx, mb: 2 }}
      >
        {labels.gmailPreset}
      </Button>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.75,
        }}
      >
        <TextField
          fullWidth
          size="small"
          label={labels.host}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={value.host}
          onChange={(e) => setField('host', e.target.value)}
          placeholder="smtp.gmail.com"
        />
        <TextField
          fullWidth
          size="small"
          type="number"
          label={labels.port}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={value.port}
          onChange={(e) => setField('port', parseInt(e.target.value, 10) || 587)}
        />
        <FormControlLabel
          sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}
          control={
            <Switch
              size="small"
              disabled={disabled}
              checked={value.secure}
              onChange={(e) => setField('secure', e.target.checked)}
            />
          }
          label={labels.secure}
        />
        <TextField
          fullWidth
          size="small"
          label={labels.authUser}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={value.authUser}
          onChange={(e) => setField('authUser', e.target.value)}
          autoComplete="off"
        />
        <TextField
          fullWidth
          size="small"
          type={passVisible || showMask ? 'text' : 'password'}
          label={labels.authPass}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={showMask ? MAIL_PASS_MASK : value.authPass}
          onChange={(e) => setField('authPass', e.target.value)}
          onFocus={() => setPassFocused(true)}
          onBlur={() => setPassFocused(false)}
          autoComplete="new-password"
          helperText={value.authPassConfigured ? labels.authPassHint : undefined}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={passVisible ? 'hide password' : 'show password'}
                  onClick={() => setPassVisible((v) => !v)}
                  disabled={disabled}
                >
                  {passVisible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          size="small"
          label={labels.fromEmail}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={value.fromEmail}
          onChange={(e) => setField('fromEmail', e.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          label={labels.fromName}
          sx={mvsSearchFieldSx}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={value.fromName}
          onChange={(e) => setField('fromName', e.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          label={labels.testTo}
          sx={{ ...mvsSearchFieldSx, gridColumn: { xs: '1', sm: '1 / -1' } }}
          {...mvsOutlinedLabelProps}
          disabled={disabled}
          value={testTo}
          onChange={(e) => onTestToChange(e.target.value)}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disabled={disabled || saving}
          onClick={onSave}
          sx={mvsBodyPrimaryBtnSx}
        >
          {labels.save}
        </Button>
        <Button
          variant="outlined"
          disabled={disabled || testing}
          onClick={onTest}
          sx={mvsBodyOutlinedBtnSx}
        >
          {labels.testSend}
        </Button>
      </Box>
    </>
  );
};

export default SmtpServerForm;
