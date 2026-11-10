import React, { useId } from 'react';
import { Box, TextField, TextFieldProps, Typography } from '@mui/material';

/**
 * 다이얼로그·폼에서 MUI Outlined 플로팅 라벨(노치)이 잘리는 문제를 피하기 위한 필드입니다.
 * 라벨은 입력 박스 밖에 두고, 입력은 hiddenLabel로 노치 없이 그립니다.
 * (body 전역 font-size 등이 작을 때도 안정적입니다.)
 */
export type FormFieldLabeledProps = Omit<TextFieldProps, 'label' | 'InputLabelProps'> & {
  /** 화면에 보이는 라벨 (label prop은 TextField에 넣지 않음) */
  fieldLabel: string;
  /** 라벨 옆에 * 표시 */
  requiredMark?: boolean;
};

const FormFieldLabeled = React.forwardRef<HTMLDivElement, FormFieldLabeledProps>(function FormFieldLabeled(
  { fieldLabel, requiredMark, id, sx, ...textFieldProps },
  ref
) {
  const uid = useId();
  const fieldId = id ?? `ff-${uid.replace(/:/g, '')}`;

  return (
    <Box ref={ref} sx={sx}>
      <Typography
        component="label"
        variant="subtitle2"
        htmlFor={fieldId}
        sx={{
          display: 'block',
          mb: 0.75,
          fontWeight: 600,
          color: 'text.primary',
          lineHeight: 1.5,
          fontSize: '0.875rem'
        }}
      >
        {fieldLabel}
        {requiredMark ? ' *' : ''}
      </Typography>
      <TextField
        {...textFieldProps}
        id={fieldId}
        fullWidth
        variant="outlined"
        hiddenLabel
        size={textFieldProps.size ?? 'medium'}
      />
    </Box>
  );
});

export default FormFieldLabeled;
