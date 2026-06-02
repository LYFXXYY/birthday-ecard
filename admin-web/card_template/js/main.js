// 页面切换功能
function goToPage(pageNum) {
    const page1 = document.getElementById('page1');
    const page2 = document.getElementById('page2');
    
    if (!page1 || !page2) return;

    if (pageNum === 2) {
        page1.classList.add('hidden');
        page2.classList.remove('hidden');
        // 添加滑动动画效果
        page2.style.animation = 'slideInRight 0.5s ease-out';
    } else {
        page2.classList.add('hidden');
        page1.classList.remove('hidden');
        page1.style.animation = 'slideInLeft 0.5s ease-out';
    }
    
    // 滚动到顶部
    window.scrollTo(0, 0);
}

// 祝福词数据库 - 根据性别和年龄生成不同祝福
const blessingDatabase = {
    male: {
        young: {
            title: '青春年华',
            blessing: '正值青春年华的你，愿每一天都充满阳光与活力！事业蒸蒸日上，梦想终将实现！'
        },
        middle: {
            title: '成熟稳重',
            blessing: '成熟稳重的你，是团队的中流砥柱。愿事业有成，家庭幸福，人生圆满！'
        },
        senior: {
            title: '资深贡献',
            blessing: '感谢您多年的辛勤付出！愿您健康长寿，幸福安康，享受美好人生！'
        }
    },
    female: {
        young: {
            title: '青春靓丽',
            blessing: '青春靓丽的你，愿永远保持这份美丽与活力！工作顺利，生活甜蜜，幸福满满！'
        },
        middle: {
            title: '优雅知性',
            blessing: '优雅知性的你，散发着独特的魅力。愿事业家庭双丰收，永远年轻美丽！'
        },
        senior: {
            title: '温婉大方',
            blessing: '温婉大方的您，是大家的榜样。愿您健康幸福，生活如诗如画，美好常伴！'
        }
    },
    all: {
        young: {
            title: '青春飞扬',
            blessing: '青春飞扬的年纪，愿你勇敢追梦，不负韶华，未来可期！'
        },
        middle: {
            title: '奋斗正当时',
            blessing: '正是奋斗的好年华，愿你事业有成，生活美满，一切顺心如意！'
        },
        senior: {
            title: '岁月静好',
            blessing: '岁月静好，愿你身体健康，心情愉悦，享受生活的美好时光！'
        }
    }
};

// 根据性别和年龄加载祝福词
function loadBlessingByGenderAndAge(gender, age) {
    let ageGroup = 'young';
    if (age >= 40 && age < 55) {
        ageGroup = 'middle';
    } else if (age >= 55) {
        ageGroup = 'senior';
    }
    
    let blessingData = blessingDatabase.all[ageGroup];
    if (gender === 'male' && blessingDatabase.male[ageGroup]) {
        blessingData = blessingDatabase.male[ageGroup];
    } else if (gender === 'female' && blessingDatabase.female[ageGroup]) {
        blessingData = blessingDatabase.female[ageGroup];
    }
    
    return blessingData;
}

// 背景音乐控制
document.addEventListener('DOMContentLoaded', function() {
    const bgMusic = document.getElementById('bgMusic');
    const musicToggle = document.getElementById('musicToggle');
    let isPlaying = false;
    
    // 获取性别和年龄信息
    const gender = document.body.dataset.gender || 'all';
    const age = parseInt(document.body.dataset.age) || 25;
    
    // 加载个性化祝福
    const blessingData = loadBlessingByGenderAndAge(gender, age);
    console.log(`加载祝福 - 性别: ${gender}, 年龄: ${age}, 主题: ${blessingData.title}`);
    
    // 这里可以将祝福词渲染到页面上，假设页面有对应的元素
    // 例如: document.querySelector('.blessing-title').textContent = blessingData.title;
    // document.querySelector('.blessing-content').textContent = blessingData.blessing;

    // 微信环境音频自动播放处理
    function initAudio() {
        // 尝试自动播放
        bgMusic.play().then(() => {
            isPlaying = true;
            musicToggle.classList.add('playing');
        }).catch(error => {
            console.log('自动播放失败，等待用户交互:', error);
            // 微信浏览器兼容性处理
            if (typeof WeixinJSBridge !== 'undefined') {
                WeixinJSBridge.invoke('getNetworkType', {}, function() {
                    bgMusic.play();
                    isPlaying = true;
                    musicToggle.classList.add('playing');
                });
            }
        });
    }

    // 监听 WeixinJSBridgeReady 事件（微信环境）
    document.addEventListener('WeixinJSBridgeReady', function() {
        initAudio();
    });

    // 首次用户交互后播放
    document.addEventListener('click', function playOnce() {
        if (!isPlaying) {
            bgMusic.play().then(() => {
                isPlaying = true;
                musicToggle.classList.add('playing');
            }).catch(error => {
                console.log('播放失败:', error);
            });
        }
        // 只触发一次
        document.removeEventListener('click', playOnce);
    });

    // 音乐按钮点击
    musicToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止触发 document 的 click 事件
        
        if (isPlaying) {
            bgMusic.pause();
            isPlaying = false;
            musicToggle.classList.remove('playing');
            musicToggle.textContent = '🔇';
        } else {
            bgMusic.play().then(() => {
                isPlaying = true;
                musicToggle.classList.add('playing');
                musicToggle.textContent = '🎵';
            }).catch(error => {
                console.log('播放失败:', error);
            });
        }
    });

    // 添加CSS动画关键帧
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideInLeft {
            from {
                transform: translateX(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .hidden {
            display: none;
        }
    `;
    document.head.appendChild(style);

    // 添加页面加载动画
    const cardContainer = document.querySelector('.card-container');
    if (cardContainer) {
        cardContainer.style.opacity = '0';
        
        setTimeout(() => {
            cardContainer.style.transition = 'opacity 0.5s ease-in';
            cardContainer.style.opacity = '1';
        }, 100);
    }

    console.log('生日贺卡加载完成');
});