import React from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import type { ButtonProps } from '@mui/material/Button';
import type { IconButtonProps } from '@mui/material/IconButton';
import {
  useMenuActionGuard,
  type MenuPermissionAction,
} from '../../hooks/useMenuActionGuard';

type CommonProps = {
  /** MUI Button `action` ref 와 충돌 방지 */
  permissionAction: MenuPermissionAction;
  menuRoutes?: readonly string[];
};

export function MenuPermissionButton({
  permissionAction,
  menuRoutes,
  disabled,
  onClick,
  children,
  ...props
}: CommonProps & ButtonProps) {
  const { disabled: permDisabled, tooltipTitle, guard } = useMenuActionGuard(
    permissionAction,
    menuRoutes
  );
  const isDisabled = permDisabled || Boolean(disabled);

  return (
    <Tooltip title={tooltipTitle} disableHoverListener={!tooltipTitle}>
      <span style={{ display: 'inline-flex' }}>
        <Button
          {...props}
          disabled={isDisabled}
          onClick={(event) => {
            if (!guard()) return;
            onClick?.(event);
          }}
        >
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}

export function MenuPermissionIconButton({
  permissionAction,
  menuRoutes,
  disabled,
  onClick,
  children,
  ...props
}: CommonProps & IconButtonProps) {
  const { disabled: permDisabled, tooltipTitle, guard } = useMenuActionGuard(
    permissionAction,
    menuRoutes
  );
  const isDisabled = permDisabled || Boolean(disabled);

  return (
    <Tooltip title={tooltipTitle} disableHoverListener={!tooltipTitle}>
      <span style={{ display: 'inline-flex' }}>
        <IconButton
          {...props}
          disabled={isDisabled}
          onClick={(event) => {
            if (!guard()) return;
            onClick?.(event);
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
