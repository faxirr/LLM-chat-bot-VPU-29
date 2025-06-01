export const SUBJECTS = {
    mathematics: {
        topics: [
            {
                name: 'Алгебра',
                subtopics: [
                    'Лінійні рівняння',
                    'Квадратні рівняння',
                    'Функції',
                    'Графіки'
                ],
                examples: {
                    'Лінійні рівняння': 'Приклад лінійного рівняння: 2x + 3 = 7',
                    'Квадратні рівняння': 'Приклад квадратного рівняння: x² + 5x + 6 = 0'
                }
            },
            {
                name: 'Геометрія',
                subtopics: [
                    'Трикутники',
                    'Чотирикутники',
                    'Кола',
                    'Площі фігур'
                ],
                formulas: {
                    'Площа трикутника': 'S = (a * h) / 2',
                    'Площа кола': 'S = πr²'
                }
            }
        ]
    },
    physics: {
        topics: [
            {
                name: 'Механіка',
                subtopics: [
                    'Кінематика',
                    'Динаміка',
                    'Закони Ньютона'
                ],
                formulas: {
                    'Швидкість': 'v = s/t',
                    'Прискорення': 'a = (v - v₀)/t'
                }
            }
        ]
    }
};

export const LEARNING_RESOURCES = {
    websites: [
        {
            name: 'Khan Academy',
            url: 'https://uk.khanacademy.org/',
            description: 'Безкоштовні онлайн-курси з різних предметів'
        },
        {
            name: 'Всеосвіта',
            url: 'https://vseosvita.ua/',
            description: 'Освітній портал для учнів та вчителів'
        }
    ],
    books: [
        {
            title: 'Математика: підручник для 7 класу',
            author: 'Мерзляк А.Г.',
            year: 2020
        }
    ]
};