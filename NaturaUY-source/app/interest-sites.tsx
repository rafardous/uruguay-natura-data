import { ProvisionalScreen } from '../src/presentation/components/ProvisionalScreen';
import { InterestSitesIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function InterestSitesScreen(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <ProvisionalScreen
      icon={<InterestSitesIcon color={colors.onPrimaryContainer} size={30} />}
      title="Sitios de interés"
      body="Estamos reuniendo una selección de lugares, proyectos y recursos para conocer mejor la naturaleza uruguaya. Próximamente."
    />
  );
}
