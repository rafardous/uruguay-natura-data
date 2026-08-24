import { ProvisionalScreen } from '../src/presentation/components/ProvisionalScreen';
import { CollaborateIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function CollaborateScreen(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <ProvisionalScreen
      icon={<CollaborateIcon color={colors.onPrimaryContainer} size={30} />}
      title="¿Te gustaría participar con Natura UY como colaborador?"
      body="Próximamente vas a poder colaborar en la rectificación y mejora de los datos del catálogo."
    />
  );
}
