import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.menu.deleteMany();

  console.log('Seeding...');
  console.log('注入管理员数据...');

  await prisma.user.create({
    data: {
      account: 'admin',
      password: '$2b$10$rWffsckbln121UhCCJs7tuJMYxpFWUHd9VGVN6bF/QuHSP2xmn6qG', // 123456
      nickname: '管理员',
      roles: {
        connectOrCreate: {
          where: { roleKey: 'admin' },
          create: {
            name: '管理员',
            sort: 1,
            roleKey: 'admin',
            menus: {
              create: [
                {
                  name: '首页',
                  path: '/dashboard',
                  icon: 'i-line-md:home',
                  sort: 1,
                },
                {
                  name: '项目管理',
                  path: '/projects',
                  icon: 'i-line-md:clipboard-list',
                  sort: 2,
                },
                {
                  name: '系统设置',
                  path: '/system',
                  icon: 'i-line-md:cog-loop',
                  sort: 3,
                },
                {
                  name: '工厂管理',
                  path: '/projects/factories',
                  icon: 'i-line-md:briefcase',
                  sort: 1,
                  parentId: 2,
                },
                {
                  name: '阀门管理',
                  path: '/projects/valves',
                  icon: 'i-line-md:compass-loop',
                  sort: 2,
                  parentId: 2,
                },
                {
                  name: '关键字管理',
                  path: '/projects/keywords',
                  icon: 'i-line-md:list-3 ',
                  sort: 3,
                  parentId: 2,
                },
                {
                  name: '分析任务管理',
                  path: '/projects/tasks',
                  icon: 'i-line-md:check-list-3 ',
                  sort: 4,
                  parentId: 2,
                },
                {
                  name: '用户管理',
                  path: '/system/users',
                  icon: 'i-line-md:account ',
                  sort: 1,
                  parentId: 3,
                },
                {
                  name: '角色管理',
                  path: '/system/roles',
                  icon: 'i-line-md:text-box-multiple',
                  sort: 2,
                  parentId: 3,
                },
                {
                  name: '菜单管理',
                  path: '/system/menus',
                  icon: 'i-line-md:menu',
                  sort: 3,
                  parentId: 3,
                },
                // { name: '评分项管理', path: '/menu', icon: 'menu', sort: 8 },
                // { name: '数据统计', path: '/menu', icon: 'menu', sort: 9 },
              ],
            },
          },
        },
      },
    },
  });

  console.log('注入管理员数据成功');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
