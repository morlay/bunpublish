import chalk from "chalk";

export interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;

  withName(name: string): Logger;
}


let colorIdx = 0;

const getColor = () => {
  const colors = [
    chalk.magenta,
    chalk.green,
    chalk.blue,
    chalk.yellow
  ];
  return colors[(++colorIdx) % colors.length]!;
};

export const createLogger = (name: string) => {

  const newLogger = (prefix: string, { color }: {
    color: typeof chalk.magenta
  }) => {
    return {
      withName(name: string) {
        return newLogger(`${prefix}:${name}`, { color: color });
      },
      info: (...args: any[]) => {
        console.log(color(`${prefix}:`), ...args);
      },
      error: (...args: any[]) => {
        console.log(color(`${prefix}:`), chalk.red(...args));
      }
    };
  };


  return newLogger(name, {
    color: getColor()
  });
};
