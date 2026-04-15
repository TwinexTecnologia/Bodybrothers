import { View } from 'react-native';

export function Skeleton() {
  return (
    <View
      style={{
        width: 160,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E1E1E1',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: '40%',
          height: '100%',
          backgroundColor: '#F2F2F2',
          opacity: 0.6,
        }}
      />
    </View>
  );
}
