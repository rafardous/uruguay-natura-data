import { ProvisionalScreen } from '../src/presentation/components/ProvisionalScreen';
import { InfoIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function AboutScreen(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <ProvisionalScreen
      icon={<InfoIcon color={colors.onPrimaryContainer} size={30} />}
      title="Acerca de Natura UY"
      body="Una guía para explorar la biodiversidad del Uruguay a partir de datos abiertos, fotografías con licencia libre y una experiencia pensada para aprender."
    />
  );
}
