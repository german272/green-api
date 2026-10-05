interface IconProps {
  size?: number
}

function Icon({ size = 24, path }: IconProps & { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  )
}

export const BackIcon = (props: IconProps) => (
  <Icon {...props} path="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
)

export const SendIcon = (props: IconProps) => (
  <Icon {...props} path="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z" />
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props} path="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
)

export const ClockIcon = (props: IconProps) => (
  <Icon
    {...props}
    path="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1 2v5.4l4.3 2.6 1-1.7-3.3-2V7z"
  />
)

export const PlaneIcon = (props: IconProps) => (
  <Icon {...props} path="M3 11.6 20.5 4.5 17.6 19.5l-5.3-3.8-2.6 2.5-.4-4.3 7-6.3-8.8 5.3z" />
)
