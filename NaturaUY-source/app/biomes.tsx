import { ProvisionalScreen } from '../src/presentation/components/ProvisionalScreen';
import { BiomesIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function BiomesScreen(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <ProvisionalScreen
      icon={<BiomesIcon color={colors.onPrimaryContainer} size={31} />}
      title="Ambientes del Uruguay"
      body="Próximamente vas a poder recorrer pastizales, humedales, montes, costas y otros ambientes, con fotografías, extensión, especies características y estado de conservación."
    />
  );
}
